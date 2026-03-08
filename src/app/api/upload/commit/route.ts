import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
    uploadBatches,
    historicalStaging,
    vendors,
    customers,
    invoices,
} from "@/lib/schema";
import { eq } from "drizzle-orm";

function getFuzzyValue(row: any, keywords: string[], fallback: string = ""): string {
    if (!row || typeof row !== 'object') return fallback;
    const keys = Object.keys(row);
    for (const key of keys) {
        const k = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (keywords.some(kw => k.includes(kw))) {
            return String(row[key]);
        }
    }
    return fallback;
}

// Helper: Resolve or create a vendor by vendorCode, return its ID
async function resolveVendorId(vendorCode: string, erpType: string, companyCode: string): Promise<string> {
    const existing = await db.select({ id: vendors.id })
        .from(vendors)
        .where(eq(vendors.vendorCode, vendorCode))
        .limit(1);
    if (existing.length > 0) return existing[0].id;

    const [nv] = await db.insert(vendors).values({
        vendorCode,
        name: `Vendor ${vendorCode}`,
        erpType,
        companyCode,
        riskLevel: "low",
    }).returning({ id: vendors.id });
    return nv.id;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { batchId } = body;

        if (!batchId) {
            return NextResponse.json({ error: "batchId is required" }, { status: 400 });
        }

        const batch = await db.query.uploadBatches.findFirst({
            where: eq(uploadBatches.id, batchId)
        });

        if (!batch) {
            return NextResponse.json({ error: "Batch not found" }, { status: 404 });
        }

        if (batch.status !== "pending_review") {
            return NextResponse.json({ error: `Batch status is '${batch.status}', expected 'pending_review'` }, { status: 400 });
        }

        const stagedRecords = await db.query.historicalStaging.findMany({
            where: eq(historicalStaging.batchId, batchId)
        });

        if (stagedRecords.length === 0) {
            return NextResponse.json({ error: "No staged records found to commit" }, { status: 400 });
        }

        const entityType = batch.entityType;
        const erpType = batch.erpType;
        let committedCount = 0;
        const errors: string[] = [];

        // ── VENDORS ──────────────────────────────────────────────
        if (entityType === "Vendors") {
            const vendorInserts = stagedRecords
                .map(record => {
                    const row = record.rowData as any;
                    const code = getFuzzyValue(row, ["lifnr", "accountnum", "vendor", "accountref", "id"], "").trim();
                    if (!code) return null;
                    return {
                        vendorCode: code,
                        name: getFuzzyValue(row, ["name", "vendorname", "desc"], "Unknown Vendor").trim(),
                        taxId: getFuzzyValue(row, ["stcd1", "vatnum", "tax", "vat"], "").trim(),
                        companyCode: getFuzzyValue(row, ["bukrs", "dataareaid", "ledger", "company", "entity"], "1000").trim(),
                        iban: getFuzzyValue(row, ["iban", "bankaccount"], "").trim(),
                        swiftBic: getFuzzyValue(row, ["swift", "bic"], "").trim(),
                        addressLine1: getFuzzyValue(row, ["stras", "address", "street"], "").trim(),
                        postalCode: getFuzzyValue(row, ["pstlz", "zip", "postal"], "").trim(),
                        country: getFuzzyValue(row, ["land1", "country", "region"], "").trim(),
                        email: getFuzzyValue(row, ["smtp", "email", "mail"], "").trim(),
                        phoneNumber: getFuzzyValue(row, ["telf1", "phone", "tel"], "").trim(),
                        erpType,
                        riskLevel: "low",
                    };
                })
                .filter(Boolean) as any[];

            if (vendorInserts.length > 0) {
                const CHUNK = 500;
                for (let i = 0; i < vendorInserts.length; i += CHUNK) {
                    await db.insert(vendors).values(vendorInserts.slice(i, i + CHUNK)).onConflictDoNothing();
                }
                committedCount = vendorInserts.length;
            }

            // ── CUSTOMERS ─────────────────────────────────────────────
        } else if (entityType === "Customers") {
            const customerInserts = stagedRecords
                .map(record => {
                    const row = record.rowData as any;
                    const num = getFuzzyValue(row, ["kunnr", "accountnum", "customer", "accountref", "id"], "").trim();
                    if (!num) return null;
                    return {
                        customerNumber: num,
                        name: getFuzzyValue(row, ["name1", "name", "desc"], "Unknown Customer").trim(),
                        taxId: getFuzzyValue(row, ["stcd1", "vat", "tax"], "").trim(),
                        billingAddress: getFuzzyValue(row, ["stras", "address", "street"], "").trim(),
                        email: getFuzzyValue(row, ["smtp", "email", "mail"], "").trim(),
                        phone: getFuzzyValue(row, ["telf1", "phone", "tel"], "").trim(),
                        companyCode: getFuzzyValue(row, ["bukrs", "dataarea", "company"], "1000").trim(),
                    };
                })
                .filter(Boolean) as any[];

            if (customerInserts.length > 0) {
                const CHUNK = 500;
                for (let i = 0; i < customerInserts.length; i += CHUNK) {
                    await db.insert(customers).values(customerInserts.slice(i, i + CHUNK)).onConflictDoNothing();
                }
                committedCount = customerInserts.length;
            }

            // ── FINANCIAL DOCUMENTS ───────────────────────────────────
        } else if (entityType === "Financial Documents" || entityType === "Invoices") {
            for (const record of stagedRecords) {
                try {
                    const row = record.rowData as any;
                    const rawAmt = getFuzzyValue(row, ["wrbtr", "amount", "gross", "total", "value"], "0").replace(/[^0-9.-]/g, "");
                    const amt = parseFloat(rawAmt) || 0;

                    const vendorCode = getFuzzyValue(row, ["lifnr", "accountnum", "vendor", "entity", "supplier"], "UNKNOWN").trim();
                    const companyCode = getFuzzyValue(row, ["bukrs", "dataarea", "ledger", "nominal", "company"], "1000").trim();

                    const vendorId = await resolveVendorId(vendorCode, erpType, companyCode);

                    const invoiceDateStr = getFuzzyValue(row, ["bldat", "invoicedate", "date", "postingdate"], "");
                    const invoiceDate = invoiceDateStr ? new Date(invoiceDateStr) : new Date();

                    await db.insert(invoices).values({
                        invoiceNumber: getFuzzyValue(row, ["xblnr", "invoiceid", "reference", "invoicenum", "document"], "INV-UNKNOWN").trim(),
                        vendorCode,
                        vendorId,
                        grossAmount: amt.toFixed(2),
                        amount: amt.toFixed(2),
                        invoiceDate: isNaN(invoiceDate.getTime()) ? new Date() : invoiceDate,
                        currency: getFuzzyValue(row, ["waers", "currencycode", "currency"], "USD").trim(),
                        erpType,
                        companyCode,
                        poNumber: getFuzzyValue(row, ["ebeln", "purchid", "purchaseorder", "po"], "").trim(),
                        lifecycleState: "PAID",
                        paymentStatus: "PAID",
                        paymentDate: new Date(),
                    }).onConflictDoNothing();
                    committedCount++;
                } catch (err: any) {
                    errors.push(err.message);
                }
            }
        }

        // Finalize batch (no transaction — Neon HTTP doesn't support it)
        await db.update(uploadBatches)
            .set({ status: "completed", errorRows: errors.length })
            .where(eq(uploadBatches.id, batchId));
        await db.delete(historicalStaging).where(eq(historicalStaging.batchId, batchId));

        return NextResponse.json({
            success: true,
            message: `Successfully committed ${committedCount} ${entityType} records to the database.`,
            errors: errors.length > 0 ? errors.slice(0, 5) : undefined
        });

    } catch (error: any) {
        console.error("Commit Failure:", error);
        return NextResponse.json({ error: "Internal commit failure", details: error.message }, { status: 500 });
    }
}
