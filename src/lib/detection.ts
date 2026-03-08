import { db } from "@/lib/db";
import { invoices, dppsConfig } from "@/lib/schema";
import { eq, and, or, sql } from "drizzle-orm";

export interface DetectionItem {
    vendorId?: string | null;
    vendorCode: string;
    invoiceNumber: string;
    amount: number;
    invoiceDate: string | Date;
    currency: string;
    companyCode: string;
}

export interface MatchCandidate {
    matchedInvoiceId: string;
    score: number;
    riskBand: 'LOW' | 'MEDIUM' | 'HIGH';
    rulesTriggered: Record<string, any>;
    matchComment?: string;
    matchedInvoice: any;
}

export interface DetectionResult extends DetectionItem {
    lineStatus: 'CLEAN' | 'FLAGGED_LOW' | 'FLAGGED_MEDIUM' | 'FLAGGED_HIGH';
    matchSummary: { candidates: MatchCandidate[] };
}

export async function detectDuplicates(items: DetectionItem[]): Promise<DetectionResult[]> {
    if (!items || items.length === 0) return [];

    // Fetch engine configurations
    let [config] = await db.select().from(dppsConfig).limit(1);

    // Fallback if the database has not been seeded yet to prevent 500 error crashes
    if (!config) {
        config = {
            criticalThreshold: "0.85",
            highThreshold: "0.70",
            mediumThreshold: "0.50",
            invoicePatternTrigger: "0.80",
            fuzzyAmountTolerance: "0.005",
            dateProximityDays: 7
        } as any;
    }

    // Define metric boundaries in percentage form (0–100).
    // DB config may store as fractions (0.85) or percentages (85) — normalize to 0-100.
    const normalize = (v: number) => v <= 1 ? v * 100 : v;
    const exactThreshold = 100; // Always 100% for exact match
    const criticalThreshold = normalize(config.criticalThreshold ? Number(config.criticalThreshold) : 0.85);
    const highThreshold = normalize(config.highThreshold ? Number(config.highThreshold) : 0.70);
    const mediumThreshold = normalize(config.mediumThreshold ? Number(config.mediumThreshold) : 0.50);
    const rulesTriggerBase = normalize(config.invoicePatternTrigger ? Number(config.invoicePatternTrigger) : 0.80);
    const amountTolerance = config.fuzzyAmountTolerance ? Number(config.fuzzyAmountTolerance) : 0.005;
    const proximityDays = config.dateProximityDays || 7;

    const results: DetectionResult[] = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        // Basic validation
        if (!item.invoiceNumber || !item.vendorCode || item.amount == null) {
            results.push({
                ...item,
                lineStatus: 'CLEAN',
                matchSummary: { candidates: [] }
            });
            continue;
        }

        // 1. Core Retrieve Candidates:
        // ALWAYS match against invoices where source_type=HISTORICAL
        // Require at least one strong key (Vendor + Company) + (amount, date, or partial invoice logic)
        // To prevent full table scans, we search specific blocks

        // Convert to Date for JS comparison logic safely
        const itemDate = new Date(item.invoiceDate);
        const amountNum = Number(item.amount);

        // Let's execute a DB query for this specific item.
        // In a high-perf scenario over millions of rows, we'd batch fetch, but for deterministic unification a tight targeted query works
        const candidates = await db.select().from(invoices).where(
            and(
                eq(invoices.sourceType, 'HISTORICAL'),
                // Only within the same company code scope
                eq(invoices.companyCode, item.companyCode),
                or(
                    // Option A: Same Vendor and Exact Invoice Number
                    and(
                        eq(invoices.vendorCode, item.vendorCode),
                        eq(invoices.invoiceNumber, item.invoiceNumber)
                    ),
                    // Option B: Same Vendor and VERY similar amount
                    and(
                        eq(invoices.vendorCode, item.vendorCode),
                        sql`ABS(${invoices.grossAmount} - ${amountNum}::numeric) <= (${amountNum}::numeric * ${amountTolerance}::numeric)`
                    )
                )
            )
        ).limit(50); // limit to bounds

        // Intra-batch Candidates — detect duplicates within the same uploaded proposal
        const intraCandidates = items.filter((intra, idx) => {
            if (idx === i) return false;
            // same company code scope required
            if (intra.companyCode !== item.companyCode) return false;
            const intraAmt = Number(intra.amount);

            // Option A: exact same invoice number (same vendor OR cross-vendor)
            const optA = intra.invoiceNumber === item.invoiceNumber;
            // Option B: same vendor + very similar amount
            const optB = intra.vendorCode === item.vendorCode && Math.abs(intraAmt - amountNum) <= (amountNum * amountTolerance);
            // Option C: same vendor + same date
            const intraDate = new Date(intra.invoiceDate);
            const intraDayDiff = Math.abs((intraDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24));
            const optC = intra.vendorCode === item.vendorCode && intraDayDiff <= proximityDays && Math.abs(intraAmt - amountNum) <= (amountNum * 0.05);
            return optA || optB || optC;
        });

        const allCandidates = [
            ...candidates.map(c => ({
                id: c.id,
                invoiceDate: new Date(c.invoiceDate),
                vendorCode: c.vendorCode,
                invoiceNumber: c.invoiceNumber,
                grossAmount: Number(c.grossAmount),
                currency: c.currency,
                sourceType: 'HISTORICAL'
            })),
            ...intraCandidates.map((c, idx) => ({
                id: `INTRA-${c.invoiceNumber}-${idx}`,
                invoiceDate: new Date(c.invoiceDate),
                vendorCode: c.vendorCode,
                invoiceNumber: c.invoiceNumber,
                grossAmount: Number(c.amount),
                currency: c.currency,
                sourceType: 'CURRENT_PROPOSAL'
            }))
        ];

        let highestScore = 0;
        const itemMatches: MatchCandidate[] = [];

        // 2. Score all candidates with dynamic field-weighted similarity
        for (const cand of allCandidates) {
            const candDate = cand.invoiceDate;
            const dayDiff = Math.abs((candDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24));

            const sameVendor = cand.vendorCode === item.vendorCode;
            const exactInvNum = cand.invoiceNumber === item.invoiceNumber;

            // Basic fuzzy invoice number (ignoring special chars, trailing spaces, leading zeros)
            const cleanItemInv = item.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const cleanCandInv = cand.invoiceNumber.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            const similarInvNum = !exactInvNum && (cleanItemInv === cleanCandInv || cleanCandInv.includes(cleanItemInv) || cleanItemInv.includes(cleanCandInv));

            const candAmount = Number(cand.grossAmount);
            const exactAmount = candAmount === amountNum;
            const exactDate = dayDiff === 0;

            // Determine if this is an intra-batch match
            const isIntraProposal = cand.sourceType === 'CURRENT_PROPOSAL';
            const sourceLabel = isIntraProposal ? '⚠ Same proposal batch' : 'Historical DB';

            // ── Dynamic Field-Weighted Similarity Scoring ─────────────────────────
            // Each field contributes a weighted point value. Score = sum of matched weights (0–100).
            // Weights:  Invoice# 30 | Vendor 25 | Amount 25 | Date 15 | Currency 5
            let fieldScore = 0;
            const matchedFields: string[] = [];
            const missedFields: string[] = [];
            const rules: Record<string, boolean> = {};

            // 1. Invoice Number (30 points)
            if (exactInvNum) {
                fieldScore += 30;
                matchedFields.push('Invoice# (exact)');
                rules['EXACT_INVOICE_NUMBER'] = true;
            } else if (similarInvNum) {
                fieldScore += 20;
                matchedFields.push('Invoice# (fuzzy)');
                rules['FUZZY_INVOICE_NUMBER'] = true;
            } else if (cleanCandInv.length > 4 && (cleanCandInv.startsWith(cleanItemInv.substring(0, 4)) || cleanItemInv.startsWith(cleanCandInv.substring(0, 4)))) {
                fieldScore += 10;
                matchedFields.push('Invoice# (partial prefix)');
                rules['PARTIAL_INVOICE_NUMBER'] = true;
            } else {
                missedFields.push('Invoice#');
            }

            // 2. Vendor Code (25 points)
            if (sameVendor) {
                fieldScore += 25;
                matchedFields.push('Vendor');
                rules['SAME_VENDOR'] = true;
            } else {
                missedFields.push('Vendor');
            }

            // 3. Amount (25 points)
            if (exactAmount) {
                fieldScore += 25;
                matchedFields.push('Amount (exact)');
                rules['EXACT_AMOUNT'] = true;
            } else if (Math.abs(candAmount - amountNum) <= amountNum * amountTolerance) {
                // Within configured tight tolerance (default 0.5%)
                fieldScore += 20;
                matchedFields.push('Amount (≤0.5% diff)');
                rules['NEAR_AMOUNT'] = true;
            } else if (Math.abs(candAmount - amountNum) <= amountNum * 0.05) {
                // Within 5% — looser match, still relevant
                fieldScore += 12;
                matchedFields.push('Amount (≤5% diff)');
                rules['CLOSE_AMOUNT'] = true;
            } else {
                missedFields.push('Amount');
            }

            // 4. Invoice Date (15 points)
            if (exactDate) {
                fieldScore += 15;
                matchedFields.push('Date (exact)');
                rules['EXACT_DATE'] = true;
            } else if (dayDiff <= proximityDays) {
                // Within configured date proximity (default 7 days) — prorate by closeness
                const datePts = Math.round(15 * (1 - dayDiff / (proximityDays + 1)));
                fieldScore += datePts;
                matchedFields.push(`Date (${Math.round(dayDiff)}d diff, +${datePts}pts)`);
                rules['NEAR_DATE'] = true;
            } else {
                missedFields.push('Date');
            }

            // 5. Currency (5 points)
            if (item.currency && cand.currency && item.currency.trim().toUpperCase() === cand.currency.trim?.()?.toUpperCase?.()) {
                fieldScore += 5;
                matchedFields.push('Currency');
                rules['SAME_CURRENCY'] = true;
            } else {
                missedFields.push('Currency');
            }

            // Clamp to 0–100 range
            const baseScore = Math.min(100, Math.round(fieldScore));

            // Build human-readable match comment
            const matchContext = isIntraProposal
                ? `INTRA-PROPOSAL [${sourceLabel}]`
                : `HISTORICAL MATCH [${sourceLabel}]`;

            const matchedStr = matchedFields.length > 0 ? `Matched: ${matchedFields.join(', ')}` : 'No key fields matched';
            const missedStr = missedFields.length > 0 ? `Unmatched: ${missedFields.join(', ')}` : 'All fields matched';

            let riskLevel = baseScore >= highThreshold ? 'HIGH RISK' : baseScore >= mediumThreshold ? 'MEDIUM RISK' : 'LOW RISK';
            const matchComment = `${matchContext} — ${baseScore}% similarity. ${matchedStr}. ${missedStr}. Risk: ${riskLevel}.`;

            // Record any hit >= mediumThreshold
            if (baseScore >= mediumThreshold) {
                if (baseScore > highestScore) highestScore = baseScore;

                let riskBand: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
                if (baseScore >= highThreshold) riskBand = 'HIGH';
                else if (baseScore >= mediumThreshold) riskBand = 'MEDIUM';

                itemMatches.push({
                    matchedInvoiceId: cand.id,
                    score: baseScore,
                    riskBand,
                    rulesTriggered: rules,
                    matchComment,
                    matchedInvoice: {
                        id: cand.id,
                        invoiceNumber: cand.invoiceNumber,
                        vendorCode: cand.vendorCode,
                        amount: candAmount,
                        invoiceDate: cand.invoiceDate,
                        currency: (cand as any).currency
                    }
                });
            }
        } // end candidate loop

        // Determine final line status based on the highest scoring hit
        let lineStatus: DetectionResult['lineStatus'] = 'CLEAN';
        if (highestScore >= highThreshold) {
            lineStatus = 'FLAGGED_HIGH';
        } else if (highestScore >= mediumThreshold) {
            lineStatus = 'FLAGGED_MEDIUM';
        }

        // Sort descending by highest score
        itemMatches.sort((a, b) => b.score - a.score);

        results.push({
            ...item,
            lineStatus,
            matchSummary: { candidates: itemMatches }
        });
    } // end items loop

    return results;
}
