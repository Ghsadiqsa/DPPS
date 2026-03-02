import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, caseActivities, cases } from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";
// Assume auth handles session, though auth isn't natively passed unless we read NextAuth
// For MVP we can just use a generic system user or null if unauthenticated.
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const userId = session?.user?.id || null;

        const body = await request.json();
        const { invoiceIds, targetStatus, notes } = body;

        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return NextResponse.json({ error: "Missing or invalid invoiceIds array." }, { status: 400 });
        }

        if (!targetStatus) {
            return NextResponse.json({ error: "Missing targetStatus." }, { status: 400 });
        }

        const validStatuses = [
            "UPLOADED",
            "AUTO_FLAGGED",
            "UNDER_INVESTIGATION",
            "BLOCKED",
            "CLEARED",
            "PAID_DUPLICATE",
            "RECOVERY_REQUIRED"
        ];

        if (!validStatuses.includes(targetStatus)) {
            return NextResponse.json({ error: "Invalid targetStatus." }, { status: 400 });
        }

        // Fetch these invoices to ensure they exist and we can log the case
        const existingInvoices = await db.select({
            id: invoices.id,
            caseId: invoices.caseId,
            status: invoices.status,
            invoiceNumber: invoices.invoiceNumber
        }).from(invoices).where(inArray(invoices.id, invoiceIds));

        if (existingInvoices.length === 0) {
            return NextResponse.json({ error: "No matching invoices found." }, { status: 404 });
        }

        // Apply bulk update
        const updateData: any = {
            status: targetStatus,
            statusUpdatedAt: new Date(),
        };

        if (userId) updateData.statusUpdatedBy = userId;
        if (notes) updateData.investigationNotes = notes;

        await db.update(invoices)
            .set(updateData)
            .where(inArray(invoices.id, existingInvoices.map(i => i.id)));

        // Create audit logs for each that bounded to a Case
        // If an invoice doesn't have a case we might generate a warning or skip case activity
        const activityInserts = existingInvoices
            .filter(inv => inv.caseId !== null)
            .map(inv => ({
                caseId: inv.caseId as string,
                userId: userId,
                action: `Status Transition: ${inv.status} -> ${targetStatus} (Inv #${inv.invoiceNumber})`,
                notes: notes || "Bulk status transition via Payment Gate / Investigation UI",
            }));

        if (activityInserts.length > 0) {
            await db.insert(caseActivities).values(activityInserts);
        }

        // Special handling for recovery auto-routing
        // If PAID_DUPLICATE -> RECOVERY_REQUIRED logic was requested
        // Our endpoint accepts the explicit targetStatus from the frontend, but we can enforce it here
        // if necessary. For now, we trust the UI to send targetStatus = RECOVERY_REQUIRED.

        return NextResponse.json({
            success: true,
            message: `Successfully transitioned ${existingInvoices.length} invoices to ${targetStatus}.`
        });

    } catch (error) {
        console.error("Error transitioning invoices:", error);
        return NextResponse.json({ error: "Failed to transition invoices." }, { status: 500 });
    }
}
