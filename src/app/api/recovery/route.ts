import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recoveryItems, recoveryActivities, invoices } from "@/lib/schema";
import { desc } from "drizzle-orm";

export async function GET() {
    try {
        const items = await db.query.recoveryItems.findMany({
            with: {
                vendor: true,
                invoice: true,
            },
            orderBy: [desc(recoveryItems.initiatedDate)],
        });

        return NextResponse.json(items);
    } catch (error) {
        console.error("Error fetching recovery items:", error);
        return NextResponse.json(
            { error: "Failed to fetch recovery items" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        console.log("Recovery POST Body:", JSON.stringify(body, null, 2));

        let invoiceId = body.invoiceId;

        // If no invoice ID provided, create the invoice record first
        if (!invoiceId && body.invoiceNumber && body.vendorId) {
            const newInvoice = await db.insert(invoices).values({
                invoiceNumber: body.invoiceNumber,
                vendorId: body.vendorId,
                amount: String(body.amount),
                invoiceDate: new Date(body.invoiceDate),
                lifecycleState: 'CONFIRMED_DUPLICATE',
                // We should also store signals if provided, but schema expects string[] for signals
                // Body sends object array. Let's skip for now or JSON stringify signals if mapped
            }).returning({ id: invoices.id });

            if (newInvoice && newInvoice[0]) {
                invoiceId = newInvoice[0].id;
            }
        }

        if (!invoiceId) {
            return NextResponse.json(
                { error: "Failed to resolve invoice ID. Provide valid invoiceId or invoiceNumber/vendorId/amount." },
                { status: 400 }
            );
        }

        // Create new recovery item
        const newItem = await db.insert(recoveryItems).values({
            invoiceId: invoiceId,
            vendorId: body.vendorId,
            amount: String(body.amount),
            status: "initiated",
            recoveryMethod: body.recoveryMethod || "email",
            notes: body.notes,
        }).returning();

        // Log activity
        await db.insert(recoveryActivities).values({
            recoveryItemId: newItem[0].id,
            action: "created",
            notes: "Recovery case initiated",
            userId: body.userId || null, // Optional if we have auth context
        });

        return NextResponse.json(newItem[0]);
    } catch (error) {
        console.error("Error creating recovery item:", error);
        return NextResponse.json(
            { error: "Failed to create recovery item" },
            { status: 500 }
        );
    }
}
