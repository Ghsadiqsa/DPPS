import { NextRequest, NextResponse } from "next/server";
import { executeTransition, LifecycleState } from "@/lib/transition";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const userId = session?.user?.id || "SYSTEM_OR_UNAUTH"; // production spec requirement ensures trackability

        const body = await request.json();
        const { invoiceIds, targetStatus, notes, reasonCode = "USER_ACTION" } = body;

        if (!invoiceIds || !Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return NextResponse.json({ error: "Missing or invalid invoiceIds array." }, { status: 400 });
        }

        if (!targetStatus) {
            return NextResponse.json({ error: "Missing targetStatus." }, { status: 400 });
        }

        const results = [];
        const errors = [];

        // Execute transitions individually using the newly built robust engine
        for (const invoiceId of invoiceIds) {
            try {
                const result = await executeTransition({
                    invoiceId,
                    toState: targetStatus as LifecycleState,
                    actorUserId: userId,
                    reasonCode,
                    notes
                });
                results.push(result.id);
            } catch (error: any) {
                errors.push({ invoiceId, message: error.message });
            }
        }

        if (errors.length > 0) {
            if (results.length === 0) {
                return NextResponse.json({ error: "All transitions failed", details: errors }, { status: 400 });
            }
            return NextResponse.json({
                success: true,
                warning: "Partial success",
                completed: results,
                failed: errors
            }, { status: 207 });
        }

        return NextResponse.json({
            success: true,
            message: `Successfully and deterministically transitioned ${results.length} invoices to ${targetStatus}.`,
            completed: results
        });

    } catch (error) {
        console.error("Critical error in transition API:", error);
        return NextResponse.json({ error: "State transition failed due to internal validation." }, { status: 500 });
    }
}
