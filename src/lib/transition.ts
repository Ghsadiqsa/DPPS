import { db } from "@/lib/db";
import { invoices, workflowEvents, Invoice } from "@/lib/schema";
import { eq } from "drizzle-orm";

export const LIFECYCLE_STATES = [
    "INGESTED",
    "RISK_SCORED",
    "FLAGGED_HIGH",
    "FLAGGED_MEDIUM",
    "FLAGGED_LOW",
    "IN_INVESTIGATION",
    "CONFIRMED_DUPLICATE",
    "NOT_DUPLICATE",
    "READY_FOR_RELEASE",
    "RELEASED_TO_PAYMENT",
    "PAID",
    "RECOVERY_OPENED",
    "RECOVERY_RESOLVED"
] as const;

export type LifecycleState = typeof LIFECYCLE_STATES[number];

// Legal Transitions Map
export const ALLOWED_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
    INGESTED: ["RISK_SCORED", "FLAGGED_HIGH", "FLAGGED_MEDIUM", "FLAGGED_LOW", "IN_INVESTIGATION"],
    RISK_SCORED: ["READY_FOR_RELEASE", "IN_INVESTIGATION"],
    FLAGGED_HIGH: ["IN_INVESTIGATION"],
    FLAGGED_MEDIUM: ["IN_INVESTIGATION"],
    FLAGGED_LOW: ["IN_INVESTIGATION", "READY_FOR_RELEASE"],
    IN_INVESTIGATION: ["CONFIRMED_DUPLICATE", "NOT_DUPLICATE", "RELEASED_TO_PAYMENT"],
    CONFIRMED_DUPLICATE: [],
    NOT_DUPLICATE: ["READY_FOR_RELEASE", "RELEASED_TO_PAYMENT"],
    READY_FOR_RELEASE: ["RELEASED_TO_PAYMENT"],
    RELEASED_TO_PAYMENT: ["PAID"],
    PAID: ["RECOVERY_OPENED"],
    RECOVERY_OPENED: ["RECOVERY_RESOLVED"],
    RECOVERY_RESOLVED: []
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
    // 1. Fetch current Invoice safely (sequential — Neon HTTP does not support transactions)
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId));

    if (!invoice) {
        throw new Error(`Execution failed: Invoice ${invoiceId} not found.`);
    }

    const fromState = invoice.lifecycleState as LifecycleState;

    // 2. Mathematically enforce transition rules
    if (!validateTransition(fromState, toState)) {
        throw new Error(`ILLEGAL STATE TRANSITION: Cannot route Invoice ${invoiceId} from ${fromState} to ${toState}.`);
    }

    // 3. Mutate the core record
    const [updatedInvoice] = await db.update(invoices).set({
        lifecycleState: toState,
        updatedAt: new Date()
    }).where(eq(invoices.id, invoiceId)).returning();

    // 4. Create Immutable Audit Log Sequence (workflow_events)
    await db.insert(workflowEvents).values({
        invoiceId,
        fromState,
        toState,
        actorUserId,
        reasonCode,
        notes: notes || null
    });

    // 5. Routing logic to Recovery Cases if needed
    if (toState === "RECOVERY_OPENED") {
        const { enterpriseRecoveryCases } = await import('@/lib/schema');
        await db.insert(enterpriseRecoveryCases).values({
            invoiceId: invoiceId,
            status: "OPEN",
            ownerUserId: actorUserId
        });
    }

    return updatedInvoice;
}
