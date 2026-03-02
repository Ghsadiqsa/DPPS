import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { historicalStaging } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const batchId = searchParams.get("batchId");

        if (!batchId) {
            return NextResponse.json({ error: "batchId is required" }, { status: 400 });
        }

        const stagedRecords = await db.query.historicalStaging.findMany({
            where: eq(historicalStaging.batchId, batchId),
            limit: 1000, // Reasonable limit for preview
        });

        return NextResponse.json({
            records: stagedRecords.map(r => ({
                id: r.id,
                entityType: r.entityType,
                rowData: r.rowData,
                validationErrors: r.validationErrors,
                createdAt: r.createdAt
            }))
        });
    } catch (error) {
        console.error("Error fetching preview records:", error);
        return NextResponse.json({ error: "Failed to fetch preview records" }, { status: 500 });
    }
}
