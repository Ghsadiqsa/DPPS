import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, vendors } from '@/lib/schema';
import { eq, and, ne, sql, or, ilike } from 'drizzle-orm';

// GET /api/invoices/[id]/compare
// Returns the flagged invoice + its best-matched historical record for side-by-side analysis
export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const params = await context.params;
        const { id } = params;

        // 1. Fetch the flagged invoice with all fields + vendor name
        const [flagged] = await db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            invoiceDate: invoices.invoiceDate,
            grossAmount: invoices.grossAmount,
            amount: invoices.amount,
            currency: invoices.currency,
            vendorCode: invoices.vendorCode,
            vendorId: invoices.vendorId,
            vendorName: vendors.name,
            lifecycleState: invoices.lifecycleState,
            riskScore: invoices.riskScore,
            riskBand: invoices.riskBand,
            poNumber: invoices.poNumber,
            erpType: invoices.erpType,
            companyCode: invoices.companyCode,
            referenceNumber: invoices.docId,  // docId maps to referenceNumber in the ERP context
            paymentStatus: invoices.paymentStatus,
            paymentDate: invoices.paymentDate,
            dueDate: invoices.dueDate,

            signals: invoices.signals,
            investigationNotes: invoices.investigationNotes,
            erpSyncStatus: invoices.erpSyncStatus,
            createdAt: invoices.createdAt,
        })
            .from(invoices)
            .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
            .where(eq(invoices.id, id))
            .limit(1);

        if (!flagged) {
            return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
        }

        // 2. Find the matched invoice
        //    Find best historical candidate by same vendor + similar amount
        let matched: any = null;

        if (flagged.vendorId) {
            const amount = parseFloat(String(flagged.grossAmount)) || 0;
            const low = (amount * 0.99).toFixed(2);
            const high = (amount * 1.01).toFixed(2);

            const candidates = await db.select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                invoiceDate: invoices.invoiceDate,
                grossAmount: invoices.grossAmount,
                amount: invoices.amount,
                currency: invoices.currency,
                vendorCode: invoices.vendorCode,
                vendorId: invoices.vendorId,
                vendorName: vendors.name,
                lifecycleState: invoices.lifecycleState,
                riskScore: invoices.riskScore,
                poNumber: invoices.poNumber,
                erpType: invoices.erpType,
                companyCode: invoices.companyCode,
                referenceNumber: invoices.docId,
                paymentStatus: invoices.paymentStatus,
                paymentDate: invoices.paymentDate,
                dueDate: invoices.dueDate,
            })
                .from(invoices)
                .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
                .where(and(
                    eq(invoices.vendorId, flagged.vendorId),
                    ne(invoices.id, id),
                    sql`${invoices.grossAmount} BETWEEN ${low} AND ${high}`
                ))
                .limit(5)
                .orderBy(sql`${invoices.invoiceDate} DESC`);

            // Pick the one that's PAID or CLEARED (most likely the original)
            matched = candidates.find(c => c.lifecycleState === 'PAID' || c.lifecycleState === 'CLEARED')
                || candidates[0]
                || null;
        }

        // 3. Compute field-level comparison commentary
        const comparison = matched ? computeComparison(flagged, matched) : null;

        return NextResponse.json({
            flagged,
            matched,
            comparison,
        });

    } catch (error: any) {
        console.error('[compare] error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// Computes per-field similarity and commentary
function computeComparison(flagged: any, matched: any) {
    const fields = [
        {
            key: 'invoiceNumber',
            label: 'Invoice Number',
            flaggedVal: flagged.invoiceNumber,
            matchedVal: matched.invoiceNumber,
        },
        {
            key: 'grossAmount',
            label: 'Gross Amount',
            flaggedVal: flagged.grossAmount,
            matchedVal: matched.grossAmount,
        },
        {
            key: 'vendorCode',
            label: 'Vendor Code',
            flaggedVal: flagged.vendorCode,
            matchedVal: matched.vendorCode,
        },
        {
            key: 'vendorName',
            label: 'Vendor Name',
            flaggedVal: flagged.vendorName,
            matchedVal: matched.vendorName,
        },
        {
            key: 'invoiceDate',
            label: 'Invoice Date',
            flaggedVal: flagged.invoiceDate,
            matchedVal: matched.invoiceDate,
        },
        {
            key: 'companyCode',
            label: 'Company Code',
            flaggedVal: flagged.companyCode,
            matchedVal: matched.companyCode,
        },
        {
            key: 'poNumber',
            label: 'PO Number',
            flaggedVal: flagged.poNumber,
            matchedVal: matched.poNumber,
        },
        {
            key: 'currency',
            label: 'Currency',
            flaggedVal: flagged.currency,
            matchedVal: matched.currency,
        },
        {
            key: 'erpType',
            label: 'ERP Type',
            flaggedVal: flagged.erpType,
            matchedVal: matched.erpType,
        },
        {
            key: 'paymentStatus',
            label: 'Payment Status',
            flaggedVal: flagged.paymentStatus,
            matchedVal: matched.paymentStatus,
        },
        {
            key: 'lifecycleState',
            label: 'Lifecycle State',
            flaggedVal: flagged.lifecycleState,
            matchedVal: matched.lifecycleState,
        },
    ];

    return fields.map(f => {
        const a = String(f.flaggedVal ?? '').toLowerCase().trim();
        const b = String(f.matchedVal ?? '').toLowerCase().trim();

        // Exact match
        const exact = a === b && a !== '' && b !== '';

        // Amount numeric nearness
        let similarity: 'exact' | 'near' | 'fuzzy' | 'different' | 'empty' = 'different';
        let commentary = '';

        if (!a && !b) {
            similarity = 'empty';
            commentary = 'Both values are absent';
        } else if (exact) {
            similarity = 'exact';
            commentary = getExactCommentary(f.key);
        } else if (f.key === 'grossAmount' || f.key === 'amount') {
            const na = parseFloat(a) || 0;
            const nb = parseFloat(b) || 0;
            const pctDiff = nb > 0 ? Math.abs(na - nb) / nb : 1;
            if (pctDiff < 0.005) {
                similarity = 'near';
                commentary = `Amounts differ by ${(pctDiff * 100).toFixed(2)}% — within fuzzy tolerance (< 0.5%). Could indicate rounding or discount adjustment on resubmission.`;
            } else {
                similarity = 'different';
                commentary = `Amounts differ by ${(pctDiff * 100).toFixed(1)}% — amounts are not a close enough match to trigger the amount signal.`;
            }
        } else if (f.key === 'invoiceNumber') {
            const sim = levenshteinSimilarity(a, b);
            if (sim >= 0.9) {
                similarity = 'near';
                commentary = `Invoice numbers are ${(sim * 100).toFixed(0)}% similar (Levenshtein). Likely a typo, OCR error, or resubmission with a minor sequence change.`;
            } else if (sim >= 0.7) {
                similarity = 'fuzzy';
                commentary = `Invoice numbers share ${(sim * 100).toFixed(0)}% character similarity — possible variant or amended invoice number.`;
            } else {
                similarity = 'different';
                commentary = `Invoice numbers are structurally different (${(sim * 100).toFixed(0)}% similar). Pattern signal did not fully trigger.`;
            }
        } else if (f.key === 'invoiceDate') {
            const da = new Date(f.flaggedVal);
            const db2 = new Date(f.matchedVal);
            if (!isNaN(da.getTime()) && !isNaN(db2.getTime())) {
                const daysDiff = Math.abs(da.getTime() - db2.getTime()) / (1000 * 60 * 60 * 24);
                if (daysDiff === 0) {
                    similarity = 'exact';
                    commentary = 'Same invoice date — identical submission window.';
                } else if (daysDiff <= 7) {
                    similarity = 'near';
                    commentary = `Dates are ${Math.round(daysDiff)} day${daysDiff !== 1 ? 's' : ''} apart — within the 7-day proximity detection window.`;
                } else {
                    similarity = 'different';
                    commentary = `Dates are ${Math.round(daysDiff)} days apart — outside the 7-day window, but other signals compensate.`;
                }
            } else {
                similarity = 'different';
                commentary = 'Date comparison unavailable.';
            }
        } else if (f.key === 'vendorName') {
            const sim = levenshteinSimilarity(a, b);
            if (sim >= 0.95) {
                similarity = 'exact';
                commentary = 'Vendor name matches exactly — same supplier identity confirmed.';
            } else if (sim >= 0.8) {
                similarity = 'near';
                commentary = `Vendor names are ${(sim * 100).toFixed(0)}% similar — possible trading name variant or abbreviation.`;
            } else {
                similarity = 'different';
                commentary = 'Vendor names differ — verify vendor master data.';
            }
        } else {
            similarity = 'different';
            commentary = 'Values do not match.';
        }

        return { ...f, similarity, commentary };
    });
}

function getExactCommentary(key: string): string {
    const map: Record<string, string> = {
        vendorCode: '⚠ Exact vendor code match — same supplier, same master record. This is a critical duplicate signal (30 pts).',
        companyCode: 'Same legal entity / company code — the payment would go to the same cost center.',
        poNumber: '⚠ Identical PO number — strongly suggests the same purchase order is being invoiced twice.',
        currency: 'Same currency — no FX exposure, amounts are directly comparable.',
        erpType: 'Same ERP source system.',
        paymentStatus: 'Both invoices share the same payment status.',
        lifecycleState: 'Both invoices are in the same lifecycle stage.',
        grossAmount: '⚠ Exact amount match — highest-weight duplicate signal (40 pts). Identical amounts are the clearest indicator of a duplicate payment attempt.',
        invoiceNumber: '⚠ Exact invoice number match — this is the same document being submitted again.',
    };
    return map[key] || 'Values match exactly.';
}

function levenshteinSimilarity(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const m = a.length, n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
        Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
    );
    for (let i = 1; i <= m; i++)
        for (let j = 1; j <= n; j++)
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return 1 - dp[m][n] / Math.max(m, n);
}
