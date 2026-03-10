import { db } from "@/lib/db";
import { invoices, dppsConfig } from "@/lib/schema";
import { eq, and, or, sql, inArray } from "drizzle-orm";

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
    groupId?: string | null;
    matchSource?: 'Intra-Proposal Duplicate' | 'Historical Data Match' | 'Mixed Match' | null;
    matchingReason?: string | null;
    systemComments?: string | null;
    matchedInvoiceCount?: number;
}

export async function detectDuplicates(items: DetectionItem[]): Promise<DetectionResult[]> {
    if (!items || items.length === 0) return [];

    // Fetch engine configurations
    let [config] = await db.select().from(dppsConfig).limit(1);

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

    const normalize = (v: number) => v <= 1 ? v * 100 : v;
    const highThreshold = normalize(config.highThreshold ? Number(config.highThreshold) : 0.70);
    const mediumThreshold = normalize(config.mediumThreshold ? Number(config.mediumThreshold) : 0.50);
    const amountTolerance = config.fuzzyAmountTolerance ? Number(config.fuzzyAmountTolerance) : 0.005;
    const proximityDays = config.dateProximityDays || 7;

    const preliminaryResults: DetectionResult[] = [];

    // Graph for clustering (nodes are indices of `items`)
    const adj: Map<number, Set<number>> = new Map();

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.invoiceNumber || !item.vendorCode || item.amount == null) {
            preliminaryResults.push({
                ...item,
                lineStatus: 'CLEAN',
                matchSummary: { candidates: [] }
            });
            continue;
        }

        const itemDate = new Date(item.invoiceDate);
        const amountNum = Number(item.amount);

        // 1. Fetch Historical Candidates
        const historicalInvoices = await db.select().from(invoices).where(
            and(
                eq(invoices.companyCode, item.companyCode),
                eq(invoices.sourceType, 'HISTORICAL'),
                or(
                    and(
                        eq(invoices.vendorCode, item.vendorCode),
                        eq(invoices.invoiceNumber, item.invoiceNumber)
                    ),
                    and(
                        eq(invoices.vendorCode, item.vendorCode),
                        sql`ABS(${invoices.grossAmount} - ${amountNum}::numeric) <= (${amountNum}::numeric * ${amountTolerance}::numeric)`
                    )
                )
            )
        ).limit(50);

        // 2. Intra-Proposal Candidates
        const intraMatches: { idx: number; item: DetectionItem }[] = [];
        items.forEach((intra, idx) => {
            if (idx === i) return;
            if (intra.companyCode !== item.companyCode) return;
            const intraAmt = Number(intra.amount);
            const intraDate = new Date(intra.invoiceDate);
            const dayDiff = Math.abs((intraDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24));

            const optA = intra.invoiceNumber === item.invoiceNumber;
            const optB = intra.vendorCode === item.vendorCode && Math.abs(intraAmt - amountNum) <= (amountNum * amountTolerance);
            const optC = intra.vendorCode === item.vendorCode && dayDiff <= proximityDays && Math.abs(intraAmt - amountNum) <= (amountNum * 0.05);

            if (optA || optB || optC) {
                intraMatches.push({ idx, item: intra });
                // Build graph for clustering
                if (!adj.has(i)) adj.set(i, new Set());
                if (!adj.has(idx)) adj.set(idx, new Set());
                adj.get(i)!.add(idx);
                adj.get(idx)!.add(i);
            }
        });

        const allCandidates = [
            ...historicalInvoices.map(c => ({
                id: c.id,
                invoiceDate: new Date(c.invoiceDate),
                vendorCode: c.vendorCode,
                invoiceNumber: c.invoiceNumber,
                grossAmount: Number(c.grossAmount),
                currency: c.currency,
                sourceType: 'HISTORICAL'
            })),
            ...intraMatches.map(({ idx, item: c }) => ({
                id: `PROPOSAL-${idx}`,
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

        for (const cand of allCandidates) {
            let fieldScore = 0;
            const matchedFields: string[] = [];
            const rules: Record<string, boolean> = {};

            const candDate = cand.invoiceDate;
            const dayDiff = Math.abs((candDate.getTime() - itemDate.getTime()) / (1000 * 3600 * 24));
            const candAmount = Number(cand.grossAmount);

            // Scoring logic
            if (cand.invoiceNumber === item.invoiceNumber) {
                fieldScore += 30;
                matchedFields.push('Invoice Number');
                rules['EXACT_INV'] = true;
            }
            if (cand.vendorCode === item.vendorCode) {
                fieldScore += 25;
                matchedFields.push('Vendor');
                rules['SAME_VENDOR'] = true;
            }
            if (candAmount === amountNum) {
                fieldScore += 25;
                matchedFields.push('Amount');
                rules['EXACT_AMOUNT'] = true;
            } else if (Math.abs(candAmount - amountNum) <= amountNum * amountTolerance) {
                fieldScore += 20;
                matchedFields.push('Similar Amount');
                rules['NEAR_AMOUNT'] = true;
            }
            if (dayDiff === 0) {
                fieldScore += 15;
                matchedFields.push('Date');
                rules['EXACT_DATE'] = true;
            } else if (dayDiff <= proximityDays) {
                fieldScore += Math.round(15 * (1 - dayDiff / (proximityDays + 1)));
                matchedFields.push('Near Date');
                rules['NEAR_DATE'] = true;
            }
            if (item.currency === cand.currency) {
                fieldScore += 5;
                matchedFields.push('Currency');
                rules['SAME_CURRENCY'] = true;
            }

            const baseScore = Math.min(100, fieldScore);
            if (baseScore >= mediumThreshold) {
                if (baseScore > highestScore) highestScore = baseScore;
                itemMatches.push({
                    matchedInvoiceId: cand.id,
                    score: baseScore,
                    riskBand: baseScore >= highThreshold ? 'HIGH' : 'MEDIUM',
                    rulesTriggered: rules,
                    matchComment: `Match on ${matchedFields.join(', ')}`,
                    matchedInvoice: cand
                });
            }
        }

        let lineStatus: DetectionResult['lineStatus'] = 'CLEAN';
        if (highestScore >= highThreshold) lineStatus = 'FLAGGED_HIGH';
        else if (highestScore >= mediumThreshold) lineStatus = 'FLAGGED_MEDIUM';

        preliminaryResults.push({
            ...item,
            lineStatus,
            matchSummary: { candidates: itemMatches.sort((a, b) => b.score - a.score) }
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. CLUSTERING ENGINE (Chain Matching & Group Assignment)
    // ─────────────────────────────────────────────────────────────────────────
    const visited = new Set<number>();
    const clusters: number[][] = [];

    for (let i = 0; i < preliminaryResults.length; i++) {
        if (!visited.has(i) && (preliminaryResults[i].lineStatus !== 'CLEAN' || adj.has(i))) {
            const cluster: number[] = [];
            const queue = [i];
            visited.add(i);
            while (queue.length > 0) {
                const curr = queue.shift()!;
                cluster.push(curr);
                const neighbors = adj.get(curr) || [];
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        visited.add(neighbor);
                        queue.push(neighbor);
                    }
                }
            }
            if (cluster.length > 0) clusters.push(cluster);
        }
    }

    // 4. Final Metadata Synthesis for Clusters
    const finalResults = [...preliminaryResults];
    clusters.forEach((cluster) => {
        const groupId = `GRP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

        cluster.forEach(idx => {
            const res = finalResults[idx];
            const itemsInGroup = cluster.length;
            const hasIntra = res.matchSummary.candidates.some(c => String(c.matchedInvoiceId).startsWith('PROPOSAL-')) || itemsInGroup > 1;
            const hasHistorical = res.matchSummary.candidates.some(c => !String(c.matchedInvoiceId).startsWith('PROPOSAL-'));

            let source: DetectionResult['matchSource'] = 'Intra-Proposal Duplicate';
            if (hasIntra && hasHistorical) source = 'Mixed Match';
            else if (hasHistorical) source = 'Historical Data Match';

            // Top Reason
            const topCandidate = res.matchSummary.candidates[0];
            const reason = topCandidate
                ? `Matched on ${Object.keys(topCandidate.rulesTriggered).join(', ')}`
                : itemsInGroup > 1 ? "Shared reference with other proposal items" : "Unknown match criteria";

            const comments = `${itemsInGroup} invoice(s) connected in this group. Match found on ${reason}. Source: ${source}. Conf Score: ${topCandidate?.score || 'N/A'}%`;

            res.groupId = groupId;
            res.matchSource = source;
            res.matchingReason = reason;
            res.systemComments = comments;
            res.matchedInvoiceCount = itemsInGroup;

            // If part of a group but labeled CLEAN, escalate status to MEDIUM if intra-duplicates exist
            if (res.lineStatus === 'CLEAN' && itemsInGroup > 1) {
                res.lineStatus = 'FLAGGED_MEDIUM';
            }
        });
    });

    return finalResults;
}

