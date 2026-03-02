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
    InsertFinancialDocument,
    historicalStaging
} from "@/lib/schema";

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const erp = formData.get("erp") as ERPType;
        const entityType = formData.get("entityType") as EntityType;
        const isSimulation = formData.get("isSimulation") === 'true';

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

            // Insert valid rows into the staging table (Phase 7: Preview Before Save)
            // But Skip if in Phase 8 (Simulation Mode)
            try {
                if (!isSimulation && validRows.length > 0) {
                    const stagingInserts = validRows.map(row => ({
                        batchId: batch.id,
                        entityType: entityType.toLowerCase().replace(/ /g, '_'), // vendors, customers, financial_documents
                        rowData: row,
                        validationErrors: [],
                    }));

                    await db.insert(historicalStaging).values(stagingInserts);
                }

                // Complete the batch with pending_review (or completed if simulated)
                await db.update(uploadBatches)
                    .set({
                        status: errorCount > 0 ? (isSimulation ? "completed_with_errors" : "error") : (isSimulation ? "completed" : "pending_review"),
                        errorRows: errorCount
                    })
                    .where(eq(uploadBatches.id, batch.id));

                console.log(`[Background] Batch ${batch.id} finished processing. Mode: ${isSimulation ? 'Simulation' : 'Execution'}`);
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
            totalRows: rowsToProcess.length,
            isSimulation
        }, { status: 202 });

    } catch (error) {
        console.error("Error processing CSV:", error);
        return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
    }
}
