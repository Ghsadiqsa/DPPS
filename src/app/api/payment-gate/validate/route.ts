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
            invoice: InvoiceData & { id?: string; status?: string };
            detection: DetectionResult | null;
            status: 'CLEAN' | 'DUPLICATE' | 'FLAGGED';
        }[] = [];

        // Check duplicates within the proposal first
        const proposalDuplicates = detectDuplicatesInProposal(
            invoicesToValidate as InvoiceData[],
            config
        );

        // Check each invoice
        for (let i = 0; i < invoicesToValidate.length; i++) {
            const rawInv = invoicesToValidate[i];

            // Normalize amount
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

            const historicalCandidates = await storage.findDuplicateInvoices(
                currentInvoice.invoiceNumber,
                currentInvoice.vendorId,
                String(amount)
            );

            let bestMatch: DetectionResult | null = null;

            // Historical check
            for (const cand of historicalCandidates) {
                const res = detectDuplicate(currentInvoice, cand, config);
                if (!bestMatch || res.score > bestMatch.score) bestMatch = res;
            }

            // Proposal check
            const pMatches = proposalDuplicates.get(i);
            if (pMatches) {
                for (const m of pMatches) {
                    if (!bestMatch || m.score > bestMatch.score) bestMatch = m;
                }
            }

            let status: 'CLEAN' | 'DUPLICATE' | 'FLAGGED' = 'CLEAN';
            if (bestMatch) {
                if (bestMatch.autoHold || bestMatch.riskLevel === 'critical') status = 'DUPLICATE';
                else if (bestMatch.riskLevel !== 'low') status = 'FLAGGED';
            }

            results.push({
                invoice: currentInvoice,
                detection: bestMatch,
                status
            });
        }

        // Upsert vendors with explicit target
        const vIds = Array.from(new Set(results.map(r => r.invoice.vendorId || 'UNKNOWN_VENDOR')));
        for (const vid of vIds) {
            try {
                // Check if vendor exists
                const [exists] = await db.select().from(vendors).where(eq(vendors.id, vid)).limit(1);
                if (!exists) {
                    await db.insert(vendors).values({
                        id: vid,
                        name: vid === 'UNKNOWN_VENDOR' ? 'Unknown Vendor' : `Vendor ${vid}`,
                        riskLevel: 'low',
                        totalSpend: "0",
                        duplicateCount: 0
                    }).onConflictDoNothing({ target: vendors.id });
                }
            } catch (err) {
                console.error(`Vendor error for ${vid}:`, err);
            }
        }

        // Batch insert invoices
        const invoiceInserts = results.map(r => {
            const date = r.invoice.invoiceDate instanceof Date ? r.invoice.invoiceDate : new Date();
            const signals = r.detection?.signals?.filter(s => s.triggered).map(s => s.name) || [];

            return {
                invoiceNumber: String(r.invoice.invoiceNumber || 'INV-UNK'),
                vendorId: String(r.invoice.vendorId || 'UNKNOWN_VENDOR'),
                amount: Number(r.invoice.amount).toFixed(2),
                invoiceDate: date,
                status: r.status === 'CLEAN' ? 'UPLOADED' : 'AUTO_FLAGGED',
                isDuplicate: r.status !== 'CLEAN',
                similarityScore: Math.round(r.detection?.score || 0),
                signals: Array.isArray(signals) ? signals : [],
                matchedInvoiceId: r.detection?.matchedInvoice?.id || null,
            };
        });

        if (invoiceInserts.length > 0) {
            const inserted = await db.insert(invoices).values(invoiceInserts).returning({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                amount: invoices.amount
            });

            // Map IDs back based on insertion order
            results.forEach((r, idx) => {
                if (inserted[idx]) {
                    r.invoice.id = inserted[idx].id;
                }
            });
        }

        // Construct response
        const summary = {
            totalLines: results.length,
            approvedLines: results.filter(r => r.status === 'CLEAN').length,
            heldLines: results.filter(r => r.status === 'DUPLICATE').length,
            reviewLines: results.filter(r => r.status === 'FLAGGED').length,
            duplicatesDetected: results.filter(r => r.status !== 'CLEAN').length,
        };

        const duplicates = results
            .filter(r => r.status !== 'CLEAN')
            .map(r => ({
                id: r.invoice.id,
                invoiceNumber: r.invoice.invoiceNumber,
                vendorId: r.invoice.vendorId,
                amount: r.invoice.amount,
                invoiceDate: r.invoice.invoiceDate instanceof Date ? r.invoice.invoiceDate.toISOString() : r.invoice.invoiceDate,
                status: r.status === 'DUPLICATE' ? 'held' : 'review',
                score: r.detection?.score,
                riskLevel: r.detection?.riskLevel,
                autoHold: r.detection?.autoHold,
                signals: r.detection?.signals?.filter(s => s.triggered) || [],
                matchedWith: r.detection?.matchedInvoice,
            }));

        return NextResponse.json({
            ...summary,
            config,
            duplicates,
            approvedForPayment: results.filter(r => r.status === 'CLEAN').map(r => ({
                ...r.invoice,
                invoiceDate: r.invoice.invoiceDate instanceof Date ? r.invoice.invoiceDate.toISOString() : r.invoice.invoiceDate
            })),
        });

    } catch (error: any) {
        console.error("Payment Gate Validation Error:", error);
        return NextResponse.json(
            { error: "Validation failed", details: error.message || String(error) },
            { status: 500 }
        );
    }
}
