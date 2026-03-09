import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { paymentBatches, paymentBatchItems, users, dppsConfig } from "@/lib/schema";
import { desc, eq } from "drizzle-orm";
import { convertCurrency } from "@/lib/currency";

export async function GET(request: NextRequest) {
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
            console.warn("API Batches: Database column mismatch - defaulting to USD.");
        }

        const batches = await db.select({
            id: paymentBatches.id,
            totalAmount: paymentBatches.totalAmount,
            totalCount: paymentBatches.totalCount,
            exportFormat: paymentBatches.exportFormat,
            status: paymentBatches.status,
            createdAt: paymentBatches.createdAt,
            createdBy: users.fullName
        })
            .from(paymentBatches)
            .leftJoin(users, eq(paymentBatches.createdBy, users.id))
            .orderBy(desc(paymentBatches.createdAt));

        const batchIds = batches.map(b => b.id);

        // Fetch items if requested
        const url = new URL(request.url);
        const includeItems = url.searchParams.get('includeItems') === 'true';

        let allItems: any[] = [];
        if (includeItems && batchIds.length > 0) {
            allItems = await db.select()
                .from(paymentBatchItems)
                // SQLite/Postgres in query fallback structure
                // For simplicity, we just fetch all items and map them below
                // This is fine since batch history items shouldn't be massive in a demo
                .execute();
        }

        const enrichedBatches = batches.map(b => ({
            ...b,
            amountInReportingCurrency: convertCurrency(Number(b.totalAmount), 'USD', reportingCurrency), // Assuming totalAmount is USD for simplification, but ideally we'd track original batch currency
            items: allItems.filter(i => i.batchId === b.id).map(i => ({
                ...i,
                amountInReportingCurrency: convertCurrency(Number(i.amount), i.currency || 'USD', reportingCurrency)
            }))
        }));

        return NextResponse.json({
            data: enrichedBatches,
            metadata: {
                reportingCurrency,
                showSideBySideAmounts: showSideBySide
            }
        });

    } catch (error: any) {
        console.error("Batches API Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch payment batches", details: error.message },
            { status: 500 }
        );
    }
}
