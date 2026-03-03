import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, vendors } from '@/lib/schema';
import { storage } from '@/lib/storage';
import { eq, sql } from 'drizzle-orm';
import {
    detectDuplicate,
    detectDuplicatesInProposal,
    DEFAULT_CONFIG,
    type InvoiceData,
    type DetectionResult,
    type DetectionConfig,
} from '@/lib/duplicate-detection';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { invoices: invoicesToValidate, config: userConfig } = body;

        if (!Array.isArray(invoicesToValidate)) {
            return NextResponse.json(
                { error: 'Invalid request format. Expected { invoices: [...] }' },
                { status: 400 }
            );
        }

        const config: DetectionConfig = { ...DEFAULT_CONFIG, ...userConfig };
        const results: {
            invoice: InvoiceData & { id?: string; lifecycleState?: string };
            detection: DetectionResult | null;
            outcome: 'CLEAN' | 'POTENTIAL_DUPLICATE' | 'BLOCKED';
        }[] = [];

        // 1. Within-proposal duplicate check
        const proposalDuplicates = detectDuplicatesInProposal(
            invoicesToValidate as InvoiceData[],
            config
        );

        // 2. Cross-reference with historical data and proposal matches
        for (let i = 0; i < invoicesToValidate.length; i++) {
            const rawInv = invoicesToValidate[i];

            // Normalize amount (CFO-grade precision)
            let amount = 0;
            if (typeof rawInv.amount === 'number') {
                amount = rawInv.amount;
            } else {
                amount = parseFloat(String(rawInv.amount).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
            }

            // Normalize date safely
            let invoiceDate: Date;
            try {
                if (rawInv.invoiceDate && typeof (rawInv.invoiceDate as any).getTime === 'function') {
                    invoiceDate = rawInv.invoiceDate as Date;
                } else if (rawInv.invoiceDate) {
                    invoiceDate = new Date(rawInv.invoiceDate);
                    if (isNaN(invoiceDate.getTime())) invoiceDate = new Date();
                } else {
                    invoiceDate = new Date();
                }
            } catch {
                invoiceDate = new Date();
            }

            const currentInvoice: InvoiceData = {
                ...rawInv,
                amount,
                invoiceDate,
            };

            // Historical check (against Billion-row scale potential)
            const historicalCandidates = await storage.findDuplicateInvoices(
                currentInvoice.invoiceNumber,
                currentInvoice.vendorId,
                String(amount)
            );

            let bestMatch: DetectionResult | null = null;

            for (const cand of historicalCandidates) {
                const res = detectDuplicate(currentInvoice, cand, config);
                if (!bestMatch || res.score > bestMatch.score) bestMatch = res;
            }

            // Proposal match check
            const pMatches = proposalDuplicates.get(i);
            if (pMatches) {
                for (const m of pMatches) {
                    if (!bestMatch || m.score > bestMatch.score) bestMatch = m;
                }
            }

            // 3. Determine Outcome based on State Machine Rules
            let outcome: 'CLEAN' | 'POTENTIAL_DUPLICATE' | 'BLOCKED' = 'CLEAN';
            if (bestMatch) {
                if (bestMatch.score >= 95) outcome = 'BLOCKED';
                else if (bestMatch.score >= 70) outcome = 'POTENTIAL_DUPLICATE';
            }

            results.push({
                invoice: currentInvoice,
                detection: bestMatch,
                outcome
            });
        }

        // 4. Persistence Layer (Audit-grade)
        const vIds = Array.from(new Set(results.map(r => r.invoice.vendorId || 'UNKNOWN_VENDOR')));
        for (const vid of vIds) {
            try {
                const [exists] = await db.select().from(vendors).where(eq(vendors.vendorCode, vid)).limit(1);
                if (!exists) {
                    await db.insert(vendors).values({
                        vendorCode: vid,
                        name: vid === 'UNKNOWN_VENDOR' ? 'Placeholder Vendor' : `Vendor ${vid}`,
                        erpType: 'GENERIC',
                        companyCode: '1000',
                        riskLevel: 'low',
                        totalSpend: "0",
                        duplicateCount: 0
                    }).onConflictDoNothing();
                }
            } catch (err) {
                console.error(`Vendor sync failure: ${vid}`, err);
            }
        }

        const invoiceInserts = results.map(r => {
            const date = r.invoice.invoiceDate instanceof Date ? r.invoice.invoiceDate : new Date();
            const signals = r.detection?.signals?.filter(s => s.triggered).map(s => s.name) || [];

            return {
                invoiceNumber: String(r.invoice.invoiceNumber || 'INV-UNK'),
                vendorCode: String(r.invoice.vendorId || 'UNKNOWN_VENDOR'),
                erpType: 'GENERIC',
                companyCode: '1000',
                grossAmount: Number(r.invoice.amount).toFixed(2),
                invoiceDate: date,
                currency: 'USD',
                lifecycleState: r.outcome === 'CLEAN' ? 'PROPOSAL' : (r.outcome === 'BLOCKED' ? 'BLOCKED' : 'POTENTIAL_DUPLICATE'),
                similarityScore: Math.round(r.detection?.score || 0),
                riskScore: Math.round(r.detection?.score || 0),
                riskBand: (r.detection?.score || 0) >= 90 ? 'HIGH' : (r.detection?.score || 0) >= 70 ? 'MEDIUM' : 'LOW',
                signals: signals,
                matchedInvoiceId: r.detection?.matchedInvoice?.id || null,
            };
        });

        if (invoiceInserts.length > 0) {
            const inserted = await db.insert(invoices).values(invoiceInserts).returning({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
            });

            results.forEach((r, idx) => {
                if (inserted[idx]) r.invoice.id = inserted[idx].id;
            });
        }

        // 5. Build Standardized Controller Response
        return NextResponse.json({
            totalLines: results.length,
            approvedLines: results.filter(r => r.outcome === 'CLEAN').length,
            duplicatesDetected: results.filter(r => r.outcome !== 'CLEAN').length,
            duplicates: results
                .filter(r => r.outcome !== 'CLEAN')
                .map(r => ({
                    id: r.invoice.id,
                    invoiceNumber: r.invoice.invoiceNumber,
                    vendorId: r.invoice.vendorId,
                    amount: r.invoice.amount,
                    invoiceDate: r.invoice.invoiceDate instanceof Date ? r.invoice.invoiceDate.toISOString() : r.invoice.invoiceDate,
                    status: (r.outcome === 'BLOCKED' ? 'BLOCKED' : 'POTENTIAL_DUPLICATE'),
                    score: Math.round(r.detection?.score || 0),
                    riskLevel: r.detection?.riskLevel,
                    signals: r.detection?.signals?.filter(s => s.triggered) || [],
                    matchedWith: r.detection?.matchedInvoice,
                })),
            approvedForPayment: results.filter(r => r.outcome === 'CLEAN').map(r => ({
                id: r.invoice.id,
                invoiceNumber: r.invoice.invoiceNumber,
                vendorId: r.invoice.vendorId,
                amount: r.invoice.amount,
                invoiceDate: r.invoice.invoiceDate instanceof Date ? r.invoice.invoiceDate.toISOString() : r.invoice.invoiceDate
            })),
        });

    } catch (error: any) {
        console.error("Payment Gate Critical Failure:", error);
        return NextResponse.json({ error: "Proposal processing failed internally", details: error.message }, { status: 500 });
    }
}
