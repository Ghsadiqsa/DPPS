import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { uploadBatches } from "@/lib/schema";
import { eq } from "drizzle-orm";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json({ error: "Batch ID is required" }, { status: 400 });
        }

        const [batch] = await db.select().from(uploadBatches).where(eq(uploadBatches.id, id));

        if (!batch) {
            return NextResponse.json({ error: "Batch not found" }, { status: 404 });
        }

        return NextResponse.json({
            id: batch.id,
            status: batch.status,
            totalRows: batch.totalRows,
            errorRows: batch.errorRows,
            completed: batch.status === 'completed' || batch.status === 'completed_with_errors' || batch.status === 'error' || batch.status === 'pending_review',
            success: batch.status === 'completed' || batch.status === 'completed_with_errors' || batch.status === 'pending_review'
        });
    } catch (error) {
        console.error("Error fetching batch status:", error);
        return NextResponse.json({ error: "Failed to fetch batch status" }, { status: 500 });
    }
}
