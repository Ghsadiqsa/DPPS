import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
    uploadBatches,
    historicalStaging,
    vendors,
    customers,
    financialDocuments,
    InsertVendor,
    InsertCustomer,
    InsertFinancialDocument
} from "@/lib/schema";
import { eq, inArray } from "drizzle-orm";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { batchId } = body;

        if (!batchId) {
            return NextResponse.json({ error: "batchId is required" }, { status: 400 });
        }

        // 1. Fetch the batch to ensure it's in pending_review
        const batch = await db.query.uploadBatches.findFirst({
            where: eq(uploadBatches.id, batchId)
        });

        if (!batch) {
            return NextResponse.json({ error: "Batch not found" }, { status: 404 });
        }

        if (batch.status !== "pending_review") {
            return NextResponse.json({ error: `Cannot commit batch in status: ${batch.status}` }, { status: 400 });
        }

        // 2. Fetch all staged records for this batch
        const stagedRecords = await db.query.historicalStaging.findMany({
            where: eq(historicalStaging.batchId, batchId)
        });

        if (stagedRecords.length === 0) {
            return NextResponse.json({ error: "No staged records found for this batch" }, { status: 400 });
        }

        // 3. Process and insert based on entity type
        const entityType = batch.entityType;

        if (entityType === "Vendors") {
            const vendorInserts: InsertVendor[] = stagedRecords.map(record => {
                const row = record.rowData as any;
                const name = String(
                    row['NAME1'] || row['Name'] || row['Vendor_Name'] || row['Vendor Name'] || row['VendorName'] || row['Supplier Name'] ||
                    (row['Supplier'] && String(row['Supplier']).length > 3 ? row['Supplier'] : null) ||
                    (row['Vendor'] && String(row['Vendor']).length > 3 ? row['Vendor'] : null) ||
                    'Unknown Vendor'
                );
                const taxId = String(row['STCD1'] || row['VATNum'] || row['Tax_Registration_Number'] || row['VAT_Number'] || row['Tax ID'] || row['TaxID'] || row['TIN'] || row['VAT'] || '');
                const iban = String(row['IBAN'] || row['BankAccount'] || row['Bank_Account_Number'] || row['Bank_Account_Name'] || row['Account Number'] || row['Bank Account'] || '');
                const address = String(row['STRAS'] || row['Address'] || row['Address_Line_1'] || row['Address Line 1'] || row['Street'] || row['Billing Address'] || '');
                const companyCode = String(row['BUKRS'] || row['DataAreaId'] || row['Ledger_Id'] || row['Company_Code'] || row['Company Codes'] || row['Company Code'] || row['Entity'] || '');
                const vendorCode = String(row['LIFNR'] || row['Vendor_Number'] || row['VendorNumber'] || row['Vendor_No'] || row['Vendor No'] || row['AccountNum'] || row['Supplier_No'] || row['Supplier No'] || row['Vendor_ID'] || row['Vendor ID'] || '');

                return {
                    name,
                    taxId,
                    iban,
                    vendorCode,
                    addressLine1: address,
                    companyCode,
                    riskLevel: "low",
                };
            });
            // Deduplication for Vendors
            const taxIds = vendorInserts.map(i => i.taxId).filter((id): id is string => !!id);
            const existingTaxIds = new Set(
                taxIds.length > 0 ? (await db.select({ taxId: vendors.taxId })
                    .from(vendors)
                    .where(inArray(vendors.taxId, taxIds)))
                    .map(e => e.taxId) : []
            );
            if (existingTaxIds.size > 0) {
                return NextResponse.json({ error: "Data already exists" }, { status: 400 });
            }

            await db.insert(vendors).values(vendorInserts);

        } else if (entityType === "Customers") {
            const customerInserts: InsertCustomer[] = stagedRecords.map(record => {
                const row = record.rowData as any;
                return {
                    customerNumber: String(row['KUNNR'] || row['AccountNum'] || row['Customer_Number'] || row['Account_Reference'] || row['Customer ID'] || row['CustomerID'] || row['Customer Number'] || 'N/A'),
                    name: String(row['NAME1'] || row['Name'] || row['Customer_Name'] || row['Customer Name'] || row['CustomerName'] || 'Unknown Customer'),
                    taxId: String(row['STCD1'] || row['VATNum'] || row['Tax_Reference'] || row['Tax ID'] || row['TaxID'] || row['VAT'] || ''),
                    billingAddress: String(row['STRAS'] || row['Address'] || row['Address1'] || row['Billing Address'] || ''),
                    companyCode: String(row['BUKRS'] || row['DataAreaId'] || row['Ledger_Id'] || row['Company_Code'] || row['Company Codes'] || row['Company Code'] || ''),
                };
            });

            // Deduplication: Fetch existing by customerNumber
            const customerNumbers = customerInserts.map(i => i.customerNumber).filter((n): n is string => !!n);
            const existingNumbers = new Set(
                customerNumbers.length > 0 ? (await db.select({ customerNumber: customers.customerNumber })
                    .from(customers)
                    .where(inArray(customers.customerNumber, customerNumbers)))
                    .map(e => e.customerNumber) : []
            );

            if (existingNumbers.size > 0) {
                return NextResponse.json({ error: "Data already exists" }, { status: 400 });
            }

            await db.insert(customers).values(customerInserts);

        } else if (entityType === "Financial Documents") {
            const docInserts: InsertFinancialDocument[] = stagedRecords.map(record => {
                const row = record.rowData as any;
                return {
                    documentNumber: String(row['BELNR'] || row['Voucher'] || row['Doc_Sequence_Value'] || row['Document_No'] || row['Document Number'] || row['Doc Number'] || row['Document ID'] || row['Invoice ID'] || 'N/A'),
                    invoiceNumber: String(row['XBLNR'] || row['InvoiceId'] || row['Invoice_Num'] || row['Reference'] || row['Invoice Number'] || row['Invoice Num'] || row['Invoice Ref'] || row['Invoice Reference'] || 'N/A'),
                    vendorId: null, // Legacy support mapping
                    invoiceDate: new Date(row['BLDAT'] || row['InvoiceDate'] || row['Invoice_Date'] || row['Date'] || row['Invoice Date'] || row['Document Date'] || new Date()),
                    amount: String(row['WRBTR'] || row['AmountCur'] || row['Invoice_Amount'] || row['Foreign_Gross_Amount'] || row['Amount'] || row['Gross Amount'] || row['Total'] || row['Invoice Amount'] || "0"),
                    currency: String(row['WAERS'] || row['CurrencyCode'] || row['Invoice_Currency_Code'] || row['Currency'] || row['Curr'] || "USD"),
                };
            });

            // Deduplication: Fetch existing by invoiceNumber
            const invoiceNumbers = docInserts.map(i => i.invoiceNumber).filter((n): n is string => !!n);
            const existingInvoices = new Set(
                invoiceNumbers.length > 0 ? (await db.select({ invoiceNumber: financialDocuments.invoiceNumber })
                    .from(financialDocuments)
                    .where(inArray(financialDocuments.invoiceNumber, invoiceNumbers)))
                    .map(e => e.invoiceNumber) : []
            );

            if (existingInvoices.size > 0) {
                return NextResponse.json({ error: "Data already exists" }, { status: 400 });
            }

            await db.insert(financialDocuments).values(docInserts);
        }

        // 4. Update Batch Status
        await db.update(uploadBatches)
            .set({ status: "completed" })
            .where(eq(uploadBatches.id, batchId));

        // 5. Cleanup Staged Records
        await db.delete(historicalStaging)
            .where(eq(historicalStaging.batchId, batchId));

        return NextResponse.json({ success: true, message: `Successfully committed ${stagedRecords.length} records.` });

    } catch (error) {
        console.error("Error committing staged records:", error);
        return NextResponse.json({ error: "Failed to commit records" }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const batchId = searchParams.get("batchId");

        if (!batchId) {
            return NextResponse.json({ error: "batchId is required" }, { status: 400 });
        }

        // 1. Cleanup Staged Records immediately
        await db.delete(historicalStaging)
            .where(eq(historicalStaging.batchId, batchId));

        // 2. Mark Batch as Cancelled/Error
        await db.update(uploadBatches)
            .set({ status: "error", errorRows: 0 }) // Error handles the UI cancellation state
            .where(eq(uploadBatches.id, batchId));

        return NextResponse.json({ success: true, message: "Upload cancelled and staged data cleared." });

    } catch (error) {
        console.error("Error cancelling upload:", error);
        return NextResponse.json({ error: "Failed to cancel upload" }, { status: 500 });
    }
}
