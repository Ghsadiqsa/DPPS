import { NextRequest, NextResponse } from "next/server";
import * as xlsx from "xlsx";
import { ERPType, EntityType } from "@/lib/erp-templates";
import { db } from "@/lib/db";
import { eq } from "drizzle-orm";
import { uploadBatches, historicalStaging } from "@/lib/schema";

export async function POST(request: NextRequest) {
    const batchRef: { id: string | null } = { id: null };
    try {
        const formData = await request.formData();
        const file = formData.get("file") as File;
        const erp = formData.get("erp") as ERPType;
        const entityType = formData.get("entityType") as EntityType;
        const isSimulation = formData.get("isSimulation") === "true";

        if (!file || !erp || !entityType) {
            return NextResponse.json({ error: "Missing required fields: file, erp, entityType" }, { status: 400 });
        }

        // --- Parse file ---
        let rawRows: any[][] = [];
        const fileName = String(file.name).toLowerCase();

        if (fileName.endsWith('.json')) {
            const text = await file.text();
            try {
                const jsonObj = JSON.parse(text);
                const arr = Array.isArray(jsonObj) ? jsonObj : [jsonObj];
                if (arr.length > 0) {
                    const headers = Object.keys(arr[0]);
                    rawRows.push(headers);
                    arr.forEach(item => {
                        rawRows.push(headers.map(h => item[h]));
                    });
                }
            } catch (e) {
                return NextResponse.json({ error: "Invalid JSON format" }, { status: 400 });
            }
        } else {
            const buffer = await file.arrayBuffer();
            const workbook = xlsx.read(buffer, { type: "array" });
            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            rawRows = xlsx.utils.sheet_to_json<any[]>(sheet, { header: 1 });
        }

        if (rawRows.length < 2) {
            return NextResponse.json({ error: "File has no data rows (only header or empty)" }, { status: 400 });
        }

        // Row 0 = ERP field names (primary header used for upload)
        // Row 1 = Conceptual mapping row (skip this — it's our template description row)
        // Row 2+ = actual data
        const headers = (rawRows[0] as string[]).map(h => String(h).replace(" (*)", "").trim());

        // Detect if row[1] is the "mapped" description row (all strings matching known conceptual names)
        // Safe heuristic: if >50% of cells in row[1] are strings that don't look like actual data, skip it
        let dataStartRow = 1;
        if (rawRows.length > 2) {
            const row1Values = rawRows[1] as any[];
            const stringCount = row1Values.filter(v => typeof v === "string").length;
            const numericCount = row1Values.filter(v => typeof v === "number").length;
            if (stringCount > numericCount && stringCount >= headers.length * 0.5) {
                dataStartRow = 2; // skip the conceptual mapping row
            }
        }

        const dataRows = rawRows.slice(dataStartRow);

        // Convert to key-value objects using ERP headers
        const data: Record<string, any>[] = dataRows
            .filter(row => (row as any[]).some((cell: any) => cell !== null && cell !== undefined && cell !== ""))
            .map(row => {
                const obj: Record<string, any> = {};
                headers.forEach((h, i) => { obj[h] = (row as any[])[i] ?? ""; });
                return obj;
            });

        if (data.length === 0) {
            return NextResponse.json({ error: "No valid data rows found in file" }, { status: 400 });
        }

        // --- Create batch record ---
        const [batch] = await db.insert(uploadBatches).values({
            erpType: erp,
            entityType: entityType,
            status: isSimulation ? "simulated" : "processing",
            totalRows: data.length,
            errorRows: 0,
        }).returning();
        batchRef.id = batch.id;

        if (isSimulation) {
            await db.update(uploadBatches).set({ status: "completed" }).where(eq(uploadBatches.id, batch.id));
            return NextResponse.json({
                message: "Simulation complete. File structure is valid.",
                batchId: batch.id,
                totalRows: data.length,
                isSimulation: true,
            });
        }

        // --- Stage records synchronously (sequential inserts — no transactions for Neon HTTP) ---
        try {
            const CHUNK_SIZE = 500;
            for (let i = 0; i < data.length; i += CHUNK_SIZE) {
                const chunk = data.slice(i, i + CHUNK_SIZE).map(row => ({
                    batchId: batch.id,
                    entityType: entityType.toLowerCase().replace(/ /g, "_"),
                    rowData: row,
                    validationErrors: [],
                }));
                await db.insert(historicalStaging).values(chunk);
            }
            await db.update(uploadBatches)
                .set({ status: "pending_review", errorRows: 0 })
                .where(eq(uploadBatches.id, batch.id));
        } catch (stagingErr: any) {
            console.error(`[Upload] Staging failed for batch ${batch.id}:`, stagingErr);
            await db.update(uploadBatches)
                .set({ status: "error", errorRows: data.length })
                .where(eq(uploadBatches.id, batch.id));
            return NextResponse.json({ error: "Failed to stage records: " + stagingErr.message, batchId: batch.id }, { status: 500 });
        }

        return NextResponse.json({
            message: "Upload processed successfully.",
            batchId: batch.id,
            totalRows: data.length,
            isSimulation: false,
        }, { status: 200 });

    } catch (error: any) {
        console.error("Error processing upload:", error);
        // Attempt to mark batch as error if it was created
        if (batchRef.id) {
            try {
                await db.update(uploadBatches).set({ status: "error" }).where(eq(uploadBatches.id, batchRef.id));
            } catch { /* ignore */ }
        }
        return NextResponse.json({ error: error.message || "Failed to process upload" }, { status: 500 });
    }
}
