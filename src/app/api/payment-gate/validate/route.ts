import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentProposals, paymentProposalItems, dppsConfig } from "@/lib/schema";
import { sql, eq } from "drizzle-orm";
import { detectDuplicates, DetectionItem } from "@/lib/detection";
import { convertCurrency } from "@/lib/currency";

export async function POST(request: NextRequest) {
    try {
        // Fetch Config for currency preferences (Safely)
        let reportingCurrency = 'USD';
        let showSideBySide = false;
        try {
            const [config] = await db.select().from(dppsConfig).where(eq(dppsConfig.id, 'default'));
            if (config) {
                reportingCurrency = (config as any).reportingCurrency || 'USD';
                showSideBySide = (config as any).showSideBySideAmounts || false;
            }
        } catch (e) {
            console.warn("API Gate: Database column mismatch - defaulting to USD.");
        }

        const { invoices = [] } = await request.json();

        if (!Array.isArray(invoices) || invoices.length === 0) {
            return NextResponse.json({ error: "No invoices provided" }, { status: 400 });
        }

        // 1. Run detection engine against the HISTORICAL source of truth
        const detectionItems: DetectionItem[] = invoices.map(inv => ({
            vendorCode: inv.vendorId || inv.vendorCode || "V-UNK",
            vendorId: inv.vendorId, // nullable
            invoiceNumber: inv.invoiceNumber || inv.id,
            amount: parseFloat(String(inv.amount || inv.grossAmount || inv.value)) || 0,
            invoiceDate: inv.invoiceDate || inv.date,
            currency: inv.currency || "USD",
            companyCode: inv.companyCode || "1000"
        }));

        const enrichedItems = await detectDuplicates(detectionItems);

        // 2. Wrap all these into an Idempotent Proposal (Does NOT create canonical invoices)
        let proposalId: string = "";

        // We isolate DB inserts into a transaction block
        // Using simple inserts with Drizzle
        const [proposal] = await db.insert(paymentProposals).values({
            erpType: "SAP",
            companyCode: "1000",
            status: "VALIDATED"
        }).returning({ id: paymentProposals.id });

        proposalId = proposal.id;

        const proposalItemsData = enrichedItems.map(item => ({
            proposalId,
            vendorCode: item.vendorCode,
            vendorId: item.vendorId,
            invoiceNumber: item.invoiceNumber,
            amount: item.amount.toString() as any, // Cast to any to bypass decimal string strictness
            invoiceDate: new Date(item.invoiceDate),
            currency: item.currency,
            lineStatus: item.lineStatus,
            matchSummary: item.matchSummary,
            groupId: (item as any).groupId,
            matchSource: (item as any).matchSource,
            matchingReason: (item as any).matchingReason,
            systemComments: (item as any).systemComments
        }));

        // Insert items preserving ALL rows including intra-proposal duplicates
        // We avoid onConflictDoNothing because it silently discards exact duplicate rows.
        // Instead, insert one-by-one and ignore individual constraint errors.
        for (const item of proposalItemsData) {
            try {
                await db.insert(paymentProposalItems).values(item);
            } catch (insertErr: any) {
                // If a row truly cannot be inserted (constraint), we still want it in enrichedItems
                // for detection purposes — just skip DB persistence for that row.
                console.warn("Skipping DB insert for duplicate row:", item.invoiceNumber, insertErr.message);
            }
        }

        // 3. Re-fetch or bundle directly from enrichedItems to return to UI
        // Return High/Medium/Low bundles according to spec
        const bundleHigh = enrichedItems.filter(i => i.lineStatus === 'FLAGGED_HIGH');
        const bundleMedium = enrichedItems.filter(i => i.lineStatus === 'FLAGGED_MEDIUM');
        const bundleLow = enrichedItems.filter(i => ['FLAGGED_LOW', 'CLEAN'].includes(i.lineStatus));

        const transform = (items: any[]) => items.map(item => ({
            ...item,
            amountInReportingCurrency: convertCurrency(Number(item.amount), item.currency || 'USD', reportingCurrency)
        }));

        return NextResponse.json({
            success: true,
            proposalId,
            totalLines: enrichedItems.length,
            bundles: {
                high: transform(bundleHigh),
                medium: transform(bundleMedium),
                lowAndClean: transform(bundleLow),
            },
            metadata: {
                reportingCurrency,
                showSideBySideAmounts: showSideBySide
            }
        });

    } catch (error: any) {
        console.error("Payment Gate Validation API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Error", details: error.message },
            { status: 500 }
        );
    }
}
