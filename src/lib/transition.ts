import { db } from "@/lib/db";
import { invoices, workflowEvents, Invoice } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const LIFECYCLE_STATES = [
    "PROPOSAL",
    "RISK_SCORED",
    "POTENTIAL_DUPLICATE",
    "BLOCKED",
    "CLEARED",
    "PAID",
    "PAID_DUPLICATE",
    "RECOVERY",
    "RESOLVED"
] as const;

export type LifecycleState = typeof LIFECYCLE_STATES[number];

// Legal Transitions Map
export const ALLOWED_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
    PROPOSAL: ["RISK_SCORED"],
    RISK_SCORED: ["POTENTIAL_DUPLICATE", "CLEARED"],
    POTENTIAL_DUPLICATE: ["BLOCKED", "CLEARED"],
    BLOCKED: ["CLEARED", "RESOLVED"],
    CLEARED: ["PAID"],
    PAID: ["PAID_DUPLICATE", "RESOLVED"],
    PAID_DUPLICATE: ["RECOVERY"],
    RECOVERY: ["RESOLVED"],
    RESOLVED: []
};

/**
 * Validates if moving an invoice from one state to another is legally permitted.
 */
export function validateTransition(fromState: string, toState: string): boolean {
    const from = fromState as LifecycleState;
    const to = toState as LifecycleState;

    if (!LIFECYCLE_STATES.includes(from) || !LIFECYCLE_STATES.includes(to)) {
        return false;
    }

    const permitted = ALLOWED_TRANSITIONS[from];
    return permitted ? permitted.includes(to) : false;
}

/**
 * Executes a state transition atomically inside a DB transaction.
 * Writes to workflow_events and updates invoice lifecycle_state + updated_at.
 */
export async function executeTransition({
    invoiceId,
    toState,
    actorUserId,
    reasonCode,
    notes
}: {
    invoiceId: string;
    toState: LifecycleState;
    actorUserId: string;
    reasonCode: string;
    notes?: string;
}) {
    return await db.transaction(async (tx) => {
        // 1. Fetch current Invoice safely
        const [invoice] = await tx.select().from(invoices).where(eq(invoices.id, invoiceId));

        if (!invoice) {
            throw new Error(`Execution failed: Invoice ${invoiceId} not found.`);
        }

        const fromState = invoice.lifecycleState as LifecycleState;

        // 2. Mathematically enforce transition rules
        if (!validateTransition(fromState, toState)) {
            throw new Error(`ILLEGAL STATE TRANSITION: Cannot route Invoice ${invoiceId} from ${fromState} to ${toState}.`);
        }

        // 3. Mutate the core record
        const [updatedInvoice] = await tx.update(invoices).set({
            lifecycleState: toState,
            updatedAt: new Date()
        }).where(eq(invoices.id, invoiceId)).returning();

        // 4. Create Immutable Audit Log Sequence (workflow_events)
        await tx.insert(workflowEvents).values({
            invoiceId,
            fromState,
            toState,
            actorUserId,
            reasonCode,
            notes: notes || null
        });

        // Optional 5: Routing logic to Recovery Cases if needed
        if (toState === "RECOVERY") {
            const { enterpriseRecoveryCases } = await import('@/lib/schema');
            await tx.insert(enterpriseRecoveryCases).values({
                invoiceId: invoiceId,
                status: "OPEN",
                ownerUserId: actorUserId // defaulting ownership to the initiator for now
            });
        }

        return updatedInvoice;
    });
}
