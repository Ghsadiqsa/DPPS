import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, matchCandidates, paymentProposals, paymentBatches, paymentBatchItems, vendors } from "@/lib/schema";
import { eq, inArray, sql } from "drizzle-orm";

export async function POST(request: NextRequest) {
    try {
        const { action, items, proposalId, exportFormat } = await request.json();

        if (!Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No items provided for commit" }, { status: 400 });
        }

        if (!['INVESTIGATE', 'APPROVE'].includes(action)) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // --- Vendor Lookup & Auto-Creation ---
        const vendorCodes = Array.from(new Set(items.map((i: any) => i.vendorCode || "V-UNK")));
        const existingVendors = await db.select({ id: vendors.id, vendorCode: vendors.vendorCode })
            .from(vendors)
            .where(inArray(vendors.vendorCode, vendorCodes));
        const vendorMap = new Map();
        existingVendors.forEach(v => vendorMap.set(v.vendorCode, v.id));

        const missingCodes = vendorCodes.filter(c => !vendorMap.has(c));
        if (missingCodes.length > 0) {
            const newVendors = missingCodes.map(code => ({ vendorCode: code, name: `Unknown Vendor ${code}` }));
            const insertedVendors = await db.insert(vendors).values(newVendors).returning({ id: vendors.id, vendorCode: vendors.vendorCode });
            insertedVendors.forEach(v => vendorMap.set(v.vendorCode, v.id));
        }

        // Prepare Invoice Payloads
        const invoicePayloads = items.map((item: any) => {
            let lifecycleState = "RISK_SCORED";
            if (action === "INVESTIGATE") {
                lifecycleState = "IN_INVESTIGATION";
            }

            let riskBand = item.lineStatus?.replace("FLAGGED_", "") || "LOW";
            if (riskBand === "CLEAN") riskBand = "LOW";

            const vCode = item.vendorCode || "V-UNK";

            return {
                sourceType: "PROPOSAL",
                proposalId: proposalId || null,
                companyCode: item.companyCode || "1000",
                vendorCode: vCode,
                vendorId: vendorMap.get(vCode)!,
                invoiceNumber: item.invoiceNumber,
                currency: item.currency || "USD",
                grossAmount: item.amount.toString(),
                amount: item.amount.toString(),
                invoiceDate: item.invoiceDate ? new Date(item.invoiceDate) : new Date(),
                lifecycleState,
                paymentStatus: "UNPAID",
                riskBand,
                riskScore: item.matchSummary?.candidates?.[0]?.score || 0
            };
        });

        // 1. Insert into Invoices Table
        const insertedInvoices = await db.insert(invoices).values(invoicePayloads).returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber });

        // 2. Insert into Match Candidates (historical only — skip intra-proposal virtual IDs)
        // Intra-proposal candidates have synthetic IDs like "INTRA-xxx-0" that don't exist in the invoices table.
        // Inserting them would violate the FK constraint on matchedInvoiceId → invoices.id.
        const matchPairs: { invoiceId: string; matchedInvoiceId: string; score: number; riskBand: string; rulesTriggered: any }[] = [];
        for (const item of items) {
            if (!item.matchSummary?.candidates?.length) continue;

            const dbInv = insertedInvoices.find(dbI => dbI.invoiceNumber === item.invoiceNumber);
            if (dbInv) {
                for (const cand of item.matchSummary.candidates) {
                    // Skip virtual intra-proposal IDs — they are not persisted as real invoice rows
                    if (!cand.matchedInvoiceId || String(cand.matchedInvoiceId).startsWith('INTRA-')) continue;
                    matchPairs.push({
                        invoiceId: dbInv.id,
                        matchedInvoiceId: cand.matchedInvoiceId,
                        score: cand.score,
                        riskBand: cand.riskBand,
                        rulesTriggered: cand.rulesTriggered || {}
                    });
                }
            }
        }

        if (matchPairs.length > 0) {
            await db.insert(matchCandidates).values(matchPairs);
        }

        // Update Proposal Status if applicable
        if (proposalId) {
            await db.update(paymentProposals)
                .set({ status: 'COMMITTED' })
                .where(eq(paymentProposals.id, proposalId));
        }

        // Record Payment Batch — only when a real export was triggered
        // Guard 1: exportFormat must be present (means the user clicked export, not just approve)
        // Guard 2: deduplicate — skip if an identical batch (same fingerprint) already exists within the last hour
        if (action === 'APPROVE' && exportFormat) {
            const batchTotal = items.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0);

            // Fingerprint = sorted invoice numbers joined + total amount + format
            // This catches re-exports of the exact same proposal batch
            const invoicesSorted = [...items]
                .map((i: any) => i.invoiceNumber)
                .sort()
                .join('|');
            const fingerprint = `${exportFormat}::${batchTotal.toFixed(2)}::${invoicesSorted}`;

            // Check for an existing batch with the same fingerprint in the last 24h
            const existing: any = await db.execute(
                sql`SELECT id FROM payment_batches
                    WHERE content_fingerprint = ${fingerprint}
                    AND created_at > NOW() - INTERVAL '24 hours'
                    LIMIT 1`
            );

            const isDuplicate = (existing.rows?.length ?? 0) > 0;

            if (!isDuplicate) {
                const [batch] = await db.insert(paymentBatches).values({
                    totalAmount: batchTotal.toString(),
                    totalCount: items.length,
                    exportFormat: exportFormat,
                    status: "EXPORTED",
                    contentFingerprint: fingerprint
                } as any).returning({ id: paymentBatches.id });

                const batchItemsPayload = items.map((item: any) => ({
                    batchId: batch.id,
                    invoiceId: item.invoiceNumber,
                    vendorCode: item.vendorCode || "V-UNK",
                    invoiceNumber: item.invoiceNumber,
                    amount: item.amount.toString(),
                    currency: item.currency || "USD"
                }));

                if (batchItemsPayload.length > 0) {
                    await db.insert(paymentBatchItems).values(batchItemsPayload);
                }
            }
            // If isDuplicate → silently skip, do not record again
        }

        return NextResponse.json({ success: true, message: `Committed ${insertedInvoices.length} invoices to state ${action}` });

    } catch (error: any) {
        console.error("Commit API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
