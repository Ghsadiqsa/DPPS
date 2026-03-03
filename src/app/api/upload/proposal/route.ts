import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, vendors, uploadBatches, workflowEvents } from "@/lib/schema";
import { sql, eq, or, and, inArray } from "drizzle-orm";
import * as XLSX from "xlsx";
import { ERP_MAPPINGS, ERPType } from "@/lib/erp-templates";
import { detectDuplicate, DEFAULT_CONFIG, classifyRisk } from "@/lib/duplicate-detection";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const userId = session?.user?.id || "SYSTEM_OR_UNAUTH";

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const erpType = (formData.get("erpType") as ERPType) || "SAP";

        if (!file) {
            return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet);

        if (rawData.length === 0) {
            return NextResponse.json({ error: "Workbook is empty." }, { status: 400 });
        }

        // 1. Create Upload Batch
        const [batch] = await db.insert(uploadBatches).values({
            uploadedBy: userId,
            erpType: erpType,
            entityType: "Financial Documents",
            status: "processing",
            totalRows: rawData.length,
        }).returning();

        // 2. Fetch all existing invoices for comparison (Optimized: only if scale is manageable)
        // For production, we would use vector search or elastic or specific indexed comparisons.
        // For this hardening drive, we'll fetch a baseline of recent/relevant invoices.
        const existingBaseline = await db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            vendorId: invoices.vendorId,
            grossAmount: invoices.grossAmount,
            invoiceDate: invoices.invoiceDate,
            companyCode: invoices.companyCode,
            poNumber: invoices.poNumber
        })
            .from(invoices)
            .limit(5000) // Baseline limit for safety
            .orderBy(sql`${invoices.createdAt} DESC`);

        const mapping = ERP_MAPPINGS[erpType]["Financial Documents"];
        const results = [];
        const errors = [];

        // 3. Process each row
        for (const row of rawData as any[]) {
            try {
                // Map fields based on ERP template
                const mappedRow: any = {};
                mapping.forEach(field => {
                    const rowKey = Object.keys(row).find(k => k.includes(field.name));
                    if (rowKey) mappedRow[field.mappedTo || field.name] = row[rowKey];
                });

                const invoiceNumber = String(mappedRow["Invoice Number"] || mappedRow["XBLNR"] || "");
                const amount = parseFloat(String(mappedRow["Amount"] || mappedRow["WRBTR"] || 0));
                const vendorCode = String(mappedRow["Vendor/Customer ID"] || mappedRow["LIFNR"] || "");
                const invoiceDate = mappedRow["Invoice Date"] || mappedRow["BLDAT"] || new Date();
                const companyCode = String(mappedRow["Company Code"] || mappedRow["BUKRS"] || "1000");

                if (!invoiceNumber || isNaN(amount)) {
                    errors.push({ row: row, error: "Invalid invoice number or amount" });
                    continue;
                }

                // Find or Create Vendor
                let vendorId = "";
                const [existingVendor] = await db.select().from(vendors).where(eq(vendors.vendorCode, vendorCode)).limit(1);
                if (existingVendor) {
                    vendorId = existingVendor.id;
                } else {
                    const [newVendor] = await db.insert(vendors).values({
                        name: `Auto-Created ${vendorCode}`,
                        vendorCode: vendorCode,
                        companyCode: companyCode,
                        erpType: erpType
                    }).returning();
                    vendorId = newVendor.id;
                }

                // 4. Run Detection
                let maxScore = 0;
                let matchedId = null;
                let signalsArr: any[] = [];
                let matchType: any = "EXACT";

                for (const candidate of existingBaseline) {
                    const detectResult = detectDuplicate(
                        { invoiceNumber, amount, vendorId, invoiceDate, companyCode },
                        {
                            invoiceNumber: candidate.invoiceNumber,
                            amount: Number(candidate.grossAmount),
                            vendorId: candidate.vendorId,
                            invoiceDate: candidate.invoiceDate as Date,
                            companyCode: candidate.companyCode as string
                        }
                    );
                    if (detectResult.score > maxScore) {
                        maxScore = detectResult.score;
                        matchedId = candidate.id;
                        signalsArr = detectResult.signals;
                        matchType = detectResult.score === 100 ? "EXACT" : "FUZZY";
                    }
                }

                const riskLevel = classifyRisk(maxScore, DEFAULT_CONFIG);

                // Determine lifecycle state based on risk
                let lifecycleState = "RISK_SCORED";
                if (maxScore >= DEFAULT_CONFIG.criticalThreshold) {
                    lifecycleState = "BLOCKED";
                } else if (maxScore >= DEFAULT_CONFIG.mediumThreshold) {
                    lifecycleState = "POTENTIAL_DUPLICATE";
                }

                // 4.5 Manage Duplicate Groups
                let duplicateGroupId: string | null = null;
                if (matchedId && maxScore >= DEFAULT_CONFIG.mediumThreshold) {
                    const { duplicateGroups } = await import("@/lib/schema");
                    // Try to find if the candidate already belongs to a group
                    const [matchedInv] = await db.select({ gid: invoices.duplicateGroupId }).from(invoices).where(eq(invoices.id, matchedId));
                    if (matchedInv?.gid) {
                        duplicateGroupId = matchedInv.gid;
                    } else {
                        // Create a new group
                        const [newGroup] = await db.insert(duplicateGroups).values({
                            primaryInvoiceId: matchedId,
                            matchType,
                            explanationJson: { signals: signalsArr, score: maxScore }
                        }).returning();
                        duplicateGroupId = newGroup.id;
                        // Update the original invoice to belong to this group too
                        await db.update(invoices).set({ duplicateGroupId: newGroup.id }).where(eq(invoices.id, matchedId));
                    }
                }

                // 5. Insert Invoice
                const [newInv] = await db.insert(invoices).values({
                    erpType,
                    companyCode,
                    vendorCode,
                    vendorId,
                    invoiceNumber,
                    invoiceDate: new Date(invoiceDate),
                    grossAmount: amount.toString(),
                    amount: amount.toString(), // legacy
                    currency: String(mappedRow["Currency"] || "USD"),
                    poNumber: String(mappedRow["Purchase Order Number"] || ""),
                    lifecycleState: lifecycleState as any,
                    riskScore: maxScore,
                    riskBand: riskLevel.toUpperCase(),
                    isDuplicateCandidate: maxScore >= DEFAULT_CONFIG.mediumThreshold,
                    confirmedDuplicate: maxScore >= DEFAULT_CONFIG.criticalThreshold,
                    matchedInvoiceId: matchedId,
                    duplicateGroupId,
                    signals: signalsArr.map(s => JSON.stringify(s)),
                    status: lifecycleState, // legacy
                    statusUpdatedBy: userId,
                    createdAt: new Date(),
                }).returning();

                // 6. Log Workflow Event
                await db.insert(workflowEvents).values({
                    invoiceId: newInv.id,
                    fromState: "PROPOSAL",
                    toState: lifecycleState,
                    actorUserId: userId,
                    reasonCode: "BATCH_UPLOAD_AUTO_SCORE",
                    notes: `Automatic risk assessment: Score ${maxScore}% (${riskLevel})`
                });

                results.push(newInv.id);

            } catch (err: any) {
                errors.push({ row: row, error: err.message });
            }
        }

        // 7. Update Batch Status
        await db.update(uploadBatches).set({
            status: "completed",
            errorRows: errors.length
        }).where(eq(uploadBatches.id, batch.id));

        return NextResponse.json({
            success: true,
            batchId: batch.id,
            processed: results.length,
            errors: errors.length,
            errorDetails: errors.slice(0, 10) // return first 10 errors
        });

    } catch (error: any) {
        console.error("Proposal Upload Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
