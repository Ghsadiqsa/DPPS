import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import * as xlsx from "xlsx";
import { ERPType, EntityType, validateCSVRow } from "@/lib/erp-templates";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import {
    uploadBatches,
    vendors,
    customers,
    financialDocuments,
    InsertVendor,
    InsertCustomer,
    InsertFinancialDocument
} from "@/lib/schema";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const erp = formData.get("erp") as ERPType;
        const entityType = formData.get("entityType") as EntityType;

        if (!file || !erp || !entityType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = xlsx.read(buffer, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet) as Record<string, any>[];

        // Remove the first conceptually mapped row if present (optional heuristic - 
        // often the second row in our template is just describing the fields)
        // Actually, `sheet_to_json` takes row 1 as headers. If row 2 is the mapped names, 
        // it will show up as the first data element. 
        // Let's filter it out if it looks like the mapped row.
        let rowsToProcess = data;
        if (data.length > 0) {
            const firstRowValues = Object.values(data[0]);
            // If the first row values strongly resemble the field names themselves, drop it.
            // E.g. "Vendor ID", "Tax ID"
            if (firstRowValues.some(v => typeof v === 'string' && (v.includes('ID') || v.includes('Name')))) {
                rowsToProcess = data.slice(1);
            }
        }

        // 1. Acknowledge and create batch immediately
        const [batch] = await db.insert(uploadBatches).values({
            erpType: erp,
            entityType: entityType,
            status: "processing",
            totalRows: rowsToProcess.length,
            errorRows: 0,
        }).returning();

        // 2. Offload the heavy synchronous validation and DB mapping to background
        after(async () => {
            console.log(`[Background] Starting processing for batch ${batch.id}...`);
            let errorCount = 0;
            const validRows: any[] = [];
            const validationErrors: any[] = [];

            // Validate each row
            rowsToProcess.forEach((row, index) => {
                const missingFields = validateCSVRow(erp, entityType, row);
                if (missingFields.length > 0) {
                    errorCount++;
                    validationErrors.push({
                        row: index + 2, // +2 for header and 0-index offset
                        errors: missingFields.map(f => `Missing required field: ${f}`)
                    });
                } else {
                    const cleanRow: Record<string, any> = {};
                    for (const [key, value] of Object.entries(row)) {
                        const cleanKey = key.replace(' (*)', '').trim();
                        cleanRow[cleanKey] = value;
                    }
                    validRows.push(cleanRow);
                }
            });

            // If entirely failed
            if (errorCount > 0 && validRows.length === 0) {
                await db.update(uploadBatches)
                    .set({ status: "error", errorRows: errorCount })
                    .where(eq(uploadBatches.id, batch.id));
                return;
            }

            // Insert valid rows into respective tables
            try {
                if (validRows.length > 0) {
                    if (entityType === "Vendors") {
                        const vendorInserts: InsertVendor[] = validRows.map(row => {
                            const name = String(row['NAME1'] || row['Name'] || row['Vendor_Name'] || row['Vendor Name'] || row['VendorName'] || row['Supplier Name'] || row['Supplier'] || row['Vendor'] || Object.values(row)[1] || 'Unknown Vendor');
                            const taxId = String(row['STCD1'] || row['VATNum'] || row['Tax_Registration_Number'] || row['VAT_Number'] || row['Tax ID'] || row['TaxID'] || row['TIN'] || row['VAT'] || '');
                            const iban = String(row['IBAN'] || row['BankAccount'] || row['Bank_Account_Number'] || row['Bank_Account_Name'] || row['Account Number'] || row['Bank Account'] || '');
                            const address = String(row['STRAS'] || row['Address'] || row['Address_Line_1'] || row['Address Line 1'] || row['Street'] || row['Billing Address'] || '');
                            const companyCode = String(row['BUKRS'] || row['DataAreaId'] || row['Ledger_Id'] || row['Company_Code'] || row['Company Codes'] || row['Company Code'] || row['Entity'] || '');

                            return {
                                name: name,
                                taxId: taxId,
                                iban: iban,
                                addressLine1: address,
                                companyCode: companyCode,
                                riskLevel: "low",
                            };
                        });
                        await db.insert(vendors).values(vendorInserts);
                    } else if (entityType === "Customers") {
                        const customerInserts: InsertCustomer[] = validRows.map(row => {
                            return {
                                customerNumber: String(row['KUNNR'] || row['AccountNum'] || row['Customer_Number'] || row['Account_Reference'] || row['Customer ID'] || row['CustomerID'] || row['Customer Number'] || Object.values(row)[0] || 'N/A'),
                                name: String(row['NAME1'] || row['Name'] || row['Customer_Name'] || row['Customer Name'] || row['CustomerName'] || Object.values(row)[1] || 'Unknown Customer'),
                                taxId: String(row['STCD1'] || row['VATNum'] || row['Tax_Reference'] || row['Tax ID'] || row['TaxID'] || row['VAT'] || ''),
                                billingAddress: String(row['STRAS'] || row['Address'] || row['Address1'] || row['Billing Address'] || ''),
                                companyCode: String(row['BUKRS'] || row['DataAreaId'] || row['Ledger_Id'] || row['Company_Code'] || row['Company Codes'] || row['Company Code'] || ''),
                            };
                        });
                        await db.insert(customers).values(customerInserts);
                    } else if (entityType === "Financial Documents") {
                        const docInserts: InsertFinancialDocument[] = validRows.map(row => {
                            return {
                                documentNumber: String(row['BELNR'] || row['Voucher'] || row['Doc_Sequence_Value'] || row['Document_No'] || row['Document Number'] || row['Doc Number'] || row['Document ID'] || row['Invoice ID'] || Object.values(row)[0] || 'N/A'),
                                invoiceNumber: String(row['XBLNR'] || row['InvoiceId'] || row['Invoice_Num'] || row['Reference'] || row['Invoice Number'] || row['Invoice Num'] || row['Invoice Ref'] || row['Invoice Reference'] || Object.values(row)[1] || 'N/A'),
                                // Map vendor ID to our reference. In the financial docs often the 3rd column is the vendor/customer id
                                vendorId: null, // Depending on the data structure, we might leave it mapped by id link down the line. But we just store the data directly. Wait, the schema requires vendor id? Schema says vendorId is a reference to vendors.id but it's optional. Let's just create an index on vendor references if needed or ignore. Wait, `FinancialDocuments` schema: vendorId is optional? In `schema.ts`: `vendorId: varchar("vendor_id").references(() => vendors.id)`. So if we have a string we can't just shove numeric vendor IDs generated by SAP into this UUID field anyway! 
                                // Actually, `Historical Data Load` requires you to load vendors first so they get UUIDs. Financial docs probably are supposed to map to it. But right now, the original system didn't even map the `Vendor ID` from financial docs to the UUID in DB in the upload script! (It just dropped it). Let's keep dropping it or mapping it appropriately.
                                invoiceDate: new Date(row['BLDAT'] || row['InvoiceDate'] || row['Invoice_Date'] || row['Date'] || row['Invoice Date'] || row['Document Date'] || new Date()),
                                amount: String(row['WRBTR'] || row['AmountCur'] || row['Invoice_Amount'] || row['Foreign_Gross_Amount'] || row['Amount'] || row['Gross Amount'] || row['Total'] || row['Invoice Amount'] || "0"),
                                currency: String(row['WAERS'] || row['CurrencyCode'] || row['Invoice_Currency_Code'] || row['Currency'] || row['Curr'] || "USD"),
                            };
                        });
                        await db.insert(financialDocuments).values(docInserts);
                    }
                }

                // Complete the batch
                await db.update(uploadBatches)
                    .set({ status: errorCount > 0 ? "completed_with_errors" : "completed", errorRows: errorCount })
                    .where(eq(uploadBatches.id, batch.id));

                console.log(`[Background] Batch ${batch.id} finished processing.`);
            } catch (err) {
                console.error(`[Background] Failed to insert DB records for batch ${batch.id}:`, err);
                await db.update(uploadBatches)
                    .set({ status: "error" })
                    .where(eq(uploadBatches.id, batch.id));
            }
        });

        // 3. Return 202 Accepted Immediately so the UI and Vercel proxy don't timeout
        return NextResponse.json({
            message: "Upload accepted and processing in background.",
            batchId: batch.id,
            totalRows: rowsToProcess.length
        }, { status: 202 });

    } catch (error) {
        console.error("Error processing CSV:", error);
        return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
    }
}
