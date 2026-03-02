import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadBatches, historicalStaging, paymentProposals } from "@/lib/schema";
import { desc, inArray } from "drizzle-orm";

export async function GET() {
    try {
        const batches = await db.select()
            .from(uploadBatches)
            .orderBy(desc(uploadBatches.createdAt));

        return NextResponse.json(batches);
    } catch (error) {
        console.error("Error fetching upload batches:", error);
        return NextResponse.json({ error: "Failed to fetch upload batches" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { ids } = await request.json();
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ error: "Batch IDs are required" }, { status: 400 });
        }

        console.log("Deleting batches:", ids);

        // 1. Delete associated staged data and proposals first to satisfy FKs
        await db.delete(historicalStaging).where(inArray(historicalStaging.batchId, ids));
        await db.delete(paymentProposals).where(inArray(paymentProposals.batchId, ids));

        // 2. Delete the batches
        const result = await db.delete(uploadBatches).where(inArray(uploadBatches.id, ids)).returning();

        return NextResponse.json({ success: true, deletedCount: result.length });
    } catch (error) {
        console.error("Error deleting batches:", error);
        return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete batches" }, { status: 500 });
    }
}
