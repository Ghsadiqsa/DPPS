import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vendors, invoices, dppsConfig } from "@/lib/schema";
import { sql } from "drizzle-orm";

async function truncateAll() {
    await db.execute(sql`TRUNCATE TABLE payment_batch_items CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE payment_batches CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE payment_proposal_items CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE payment_proposals CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE match_candidates CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE case_events CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE cases CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE historical_staging CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE upload_batches CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE export_history CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE recovery_items CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE audit_log CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE invoices CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE vendors CASCADE;`);
    await db.execute(sql`TRUNCATE TABLE dpps_config CASCADE;`);
}

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const wipeOnly = searchParams.get("wipe") === "true";

        await truncateAll();

        // Always restore the engine config so detection still works
        await db.insert(dppsConfig).values({
            criticalThreshold: "0.85" as any,
            highThreshold: "0.70" as any,
            mediumThreshold: "0.50" as any,
            invoicePatternTrigger: "0.80" as any,
            fuzzyAmountTolerance: "0.005" as any,
            dateProximityDays: 7,
            legalEntityScope: "within"
        });

        if (wipeOnly) {
            // Complete wipe — no vendors, no invoices seeded
            return NextResponse.json({ success: true, message: "All data wiped. Vendor catalog, financial documents and reports are cleared." });
        }

        // --- Full re-seed (default, no ?wipe=true) ---

        // 150 Vendors
        const vendorPayloads = Array.from({ length: 150 }).map((_, i) => ({
            erpType: "SAP",
            companyCode: "1000",
            vendorCode: `V${String(10000 + i)}`,
            name: `Global Supplier ${i + 1} Inc`,
            country: "US"
        }));
        const insertedVendors = await db.insert(vendors).values(vendorPayloads)
            .returning({ id: vendors.id, vendorCode: vendors.vendorCode });

        // 1000 Historical Invoices in chunks
        const totalInvoices = 1000;
        const chunkSize = 250;
        for (let i = 0; i < totalInvoices; i += chunkSize) {
            const chunk = Array.from({ length: Math.min(chunkSize, totalInvoices - i) }).map((_, j) => {
                const v = insertedVendors[Math.floor(Math.random() * insertedVendors.length)];
                const amount = (Math.random() * 10000 + 100).toFixed(2);
                const daysAgo = Math.floor(Math.random() * 365);
                const invDate = new Date();
                invDate.setDate(invDate.getDate() - daysAgo);
                return {
                    sourceType: "HISTORICAL",
                    companyCode: "1000",
                    vendorCode: v.vendorCode,
                    vendorId: v.id,
                    invoiceNumber: `INV-${Date.now()}-${i + j}`,
                    grossAmount: amount as any,
                    currency: "USD",
                    invoiceDate: invDate,
                    lifecycleState: "PAID",
                    paymentStatus: "PAID"
                };
            });
            await db.insert(invoices).values(chunk);
        }

        // Known duplicate test scenarios
        const v0 = insertedVendors[0];
        const scenarioDate = new Date();
        await db.insert(invoices).values([
            { inv: "SCENARIO-1A", amt: "5000.00", date: scenarioDate },
            { inv: "SCENARIO-2-EXACT", amt: "4200.50", date: scenarioDate },
            { inv: "SCENARIO-3-PARTIAL", amt: "3100.00", date: scenarioDate },
            { inv: "SCENARIO-4-DATE", amt: "8800.00", date: new Date(scenarioDate.getTime() - 86400000) },
        ].map(s => ({
            sourceType: "HISTORICAL",
            companyCode: "1000",
            vendorCode: v0.vendorCode,
            vendorId: v0.id,
            invoiceNumber: s.inv,
            grossAmount: s.amt as any,
            currency: "USD",
            invoiceDate: s.date,
            lifecycleState: "PAID",
            paymentStatus: "PAID"
        })));

        return NextResponse.json({ success: true, message: "DPPS 2.0 Database seeded successfully with 150 vendors and 1000 historical invoices." });
    } catch (e: any) {
        console.error("Reset error:", e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
