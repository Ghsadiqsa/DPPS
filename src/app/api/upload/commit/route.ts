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
                    const code = String(
                        row["LIFNR"] || row["AccountNum"] || row["Vendor_Number"] ||
                        row["Account_Reference"] || row["Vendor ID"] || ""
                    ).trim();
                    if (!code) return null;
                    return {
                        vendorCode: code,
                        name: String(row["NAME1"] || row["Name"] || row["Vendor_Name"] || row["Vendor Name"] || "Unknown Vendor").trim(),
                        taxId: String(row["STCD1"] || row["VATNum"] || row["Tax_Registration_Number"] || row["VAT_Number"] || row["Tax ID"] || "").trim(),
                        companyCode: String(row["BUKRS"] || row["DataAreaId"] || row["Ledger_Id"] || row["Company_Code"] || row["Company Codes"] || "1000").trim(),
                        iban: String(row["IBAN"] || row["BankAccount"] || row["Bank_Account_Number"] || row["Bank_Account_Name"] || "").trim(),
                        swiftBic: String(row["SWIFT"] || row["SWIFTNo"] || row["SWIFT/BIC"] || "").trim(),
                        addressLine1: String(row["STRAS"] || row["Address"] || row["Address_Line_1"] || row["Address Line 1"] || "").trim(),
                        postalCode: String(row["PSTLZ"] || row["ZipCode"] || row["Postal_Code"] || row["Postal Code"] || "").trim(),
                        country: String(row["LAND1"] || row["CountryRegionId"] || row["Country"] || "").trim(),
                        email: String(row["SMTP_ADDR"] || row["Email"] || row["Email_Address"] || "").trim(),
                        phoneNumber: String(row["TELF1"] || row["Phone"] || row["Phone Number"] || "").trim(),
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
                    const num = String(
                        row["KUNNR"] || row["AccountNum"] || row["Customer_Number"] ||
                        row["Account_Reference"] || row["Customer ID"] || ""
                    ).trim();
                    if (!num) return null;
                    return {
                        customerNumber: num,
                        name: String(row["NAME1"] || row["Name"] || row["Customer_Name"] || row["Customer Name"] || "Unknown Customer").trim(),
                        taxId: String(row["STCD1"] || row["VATNum"] || row["Tax_Reference"] || row["Tax ID"] || "").trim(),
                        billingAddress: String(row["STRAS"] || row["Address"] || row["Address1"] || row["Billing Address"] || "").trim(),
                        email: String(row["SMTP_ADDR"] || row["Email"] || row["Email_Address"] || "").trim(),
                        phone: String(row["TELF1"] || row["Phone"] || "").trim(),
                        companyCode: String(row["BUKRS"] || row["DataAreaId"] || row["Company Codes"] || "1000").trim(),
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
                    const rawAmt = String(
                        row["WRBTR"] || row["AmountCur"] || row["Invoice_Amount"] ||
                        row["Foreign_Gross_Amount"] || row["Amount"] || "0"
                    ).replace(/[^0-9.-]/g, "");
                    const amt = parseFloat(rawAmt) || 0;

                    const vendorCode = String(
                        row["LIFNR"] || row["AccountNum"] || row["Vendor_Number"] ||
                        row["Account_Reference"] || row["Entity ID"] || row["Vendor/Customer ID"] || "UNKNOWN"
                    ).trim();

                    const companyCode = String(
                        row["BUKRS"] || row["DataAreaId"] || row["Ledger_Id"] ||
                        row["Nominal_Code"] || row["Company Code"] || "1000"
                    ).trim();

                    // Resolve vendorId (required FK)
                    const vendorId = await resolveVendorId(vendorCode, erpType, companyCode);

                    const invoiceDate = (() => {
                        const raw = row["BLDAT"] || row["InvoiceDate"] || row["Invoice_Date"] || row["Date"] || row["Invoice Date"];
                        if (!raw) return new Date();
                        if (raw instanceof Date) return raw;
                        const d = new Date(raw);
                        return isNaN(d.getTime()) ? new Date() : d;
                    })();

                    await db.insert(invoices).values({
                        invoiceNumber: String(row["XBLNR"] || row["InvoiceId"] || row["Invoice_Num"] || row["Reference"] || row["Invoice Number"] || "INV-UNKNOWN").trim(),
                        vendorCode,
                        vendorId,
                        grossAmount: amt.toFixed(2),
                        amount: amt.toFixed(2),
                        invoiceDate,
                        currency: String(row["WAERS"] || row["CurrencyCode"] || row["Invoice_Currency_Code"] || row["Currency"] || "USD").trim(),
                        erpType,
                        companyCode,
                        poNumber: String(row["EBELN"] || row["PurchId"] || row["Purchase Order Number"] || "").trim(),
                        lifecycleState: "PAID",
                        paymentStatus: "PAID",
                        paymentDate: new Date(),
                        status: "UPLOADED",
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
