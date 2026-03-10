import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, paymentProposalItems, vendors } from "@/lib/schema";
import { eq, inArray, and } from "drizzle-orm";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { groupId, items, proposalId } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ error: "No items provided for investigation" }, { status: 400 });
        }

        const invoiceNumbers = items.map(i => i.invoiceNumber);

        if (proposalId) {
            // Update line status in payment proposal items to mark them as moved to investigation
            await db.update(paymentProposalItems)
                .set({ lineStatus: 'INVESTIGATING' as any })
                .where(
                    and(
                        eq(paymentProposalItems.proposalId, proposalId),
                        inArray(paymentProposalItems.invoiceNumber, invoiceNumbers)
                    )
                );
        }

        // We also need to map these proposal invoices to the 'invoices' table or update them if they exist
        // For the sake of this prototype, we'll ensure they are inserted as PROPOSAL sources and marked correctly.
        for (const item of items) {
            let actualVendorId = item.vendorId || item.vendorCode;
            // Ensure vendor is valid UUID to satisfy FK constraints
            if (!actualVendorId || actualVendorId.length < 10) {
                const dbVendors = await db.select().from(vendors).where(eq(vendors.vendorCode, item.vendorCode || item.vendorId || "V-UNK")).limit(1);
                if (dbVendors.length > 0) {
                    actualVendorId = dbVendors[0].id;
                } else {
                    const [newVendor] = await db.insert(vendors).values({
                        vendorCode: item.vendorCode || item.vendorId || 'V-UNK',
                        name: `Vendor (${item.vendorCode || item.vendorId || 'Unknown'})`
                    }).returning({ id: vendors.id });
                    actualVendorId = newVendor.id;
                }
            }

            const existing = await db.select().from(invoices).where(
                and(
                    eq(invoices.invoiceNumber, item.invoiceNumber),
                    eq(invoices.vendorCode, item.vendorCode || item.vendorId || 'V-UNK'),
                    eq(invoices.sourceType, 'PROPOSAL')
                )
            ).limit(1);

            const matchingReason = item.matchingReason || "Investigate Potential Duplicate";
            const systemComments = item.systemComments || "";

            if (existing.length > 0) {
                // Update existing
                await db.update(invoices)
                    .set({
                        lifecycleState: 'IN_INVESTIGATION',
                        isDuplicateCandidate: true,
                        duplicateGroupId: groupId || `GRP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
                        riskScore: item.score || 0,
                        matchSource: item.matchSource || null,
                        matchingReason: item.matchingReason || null,
                        systemComments: item.systemComments || null,
                        investigationNotes: `Investigating. Reason: ${matchingReason}. ${systemComments}`
                    })
                    .where(eq(invoices.id, existing[0].id));
            } else {
                // Insert as new proposition item in the main unified store
                await db.insert(invoices).values({
                    sourceType: 'PROPOSAL',
                    proposalId: proposalId || null,
                    erpType: 'SAP', // default or from item
                    companyCode: item.companyCode || '1000',
                    vendorCode: item.vendorCode || item.vendorId || 'V-UNK',
                    vendorId: actualVendorId,
                    invoiceNumber: item.invoiceNumber,
                    grossAmount: String(item.amount) as any,
                    currency: item.currency || 'USD',
                    invoiceDate: new Date(item.invoiceDate),
                    lifecycleState: 'IN_INVESTIGATION',
                    riskScore: item.score || 0,
                    riskBand: item.riskLevel === 'High Risk' ? 'HIGH' : item.riskLevel === 'Medium Risk' ? 'MEDIUM' : 'LOW',
                    isDuplicateCandidate: true,
                    duplicateGroupId: groupId || `GRP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
                    matchSource: item.matchSource || null,
                    matchingReason: item.matchingReason || null,
                    systemComments: item.systemComments || null,
                    investigationNotes: `Investigating. Reason: ${matchingReason}. ${systemComments}`
                });
            }
        }

        return NextResponse.json({
            success: true,
            message: `Successfully moved group ${groupId || 'N/A'} (${items.length} items) to investigation.`
        });
    } catch (error: any) {
        console.error("Investigate API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
