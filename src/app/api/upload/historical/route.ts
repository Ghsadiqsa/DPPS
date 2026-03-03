import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, vendors, uploadBatches, workflowEvents, duplicateGroups, customers } from "@/lib/schema";
import { sql, eq, or } from "drizzle-orm";
import * as XLSX from "xlsx";
import { ERP_MAPPINGS, ERPType, EntityType } from "@/lib/erp-templates";
import { detectDuplicate, DEFAULT_CONFIG, classifyRisk } from "@/lib/duplicate-detection";
import { auth } from "@/auth";

export async function POST(request: NextRequest) {
    try {
        const session = await auth();
        const userId = session?.user?.id || "SYSTEM_OR_UNAUTH";

        const formData = await request.formData();
        const file = formData.get("file") as File;
        const erpType = (formData.get("erpType") as ERPType) || "SAP";
        const entityType = (formData.get("entityType") as EntityType) || "Financial Documents";
        const isSimulation = formData.get("simulation") === "true";

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
            entityType: entityType,
            status: isSimulation ? "simulated" : "processing",
            totalRows: rawData.length,
        }).returning();

        if (isSimulation) {
            return NextResponse.json({
                success: true,
                batchId: batch.id,
                processedCount: rawData.length,
                status: "Simulation Passed"
            });
        }

        const mapping = ERP_MAPPINGS[erpType][entityType];
        const results = [];
        const errors = [];

        // 2. Process based on Entity Type
        if (entityType === "Financial Documents") {
            // Fetch baseline for comparison
            const existingBaseline = await db.select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                vendorId: invoices.vendorId,
                grossAmount: invoices.grossAmount,
                invoiceDate: invoices.invoiceDate,
                companyCode: invoices.companyCode,
                duplicateGroupId: invoices.duplicateGroupId
            })
                .from(invoices)
                .limit(10000)
                .orderBy(sql`${invoices.createdAt} DESC`);

            for (const row of rawData as any[]) {
                try {
                    const mappedRow: any = {};
                    mapping.forEach(field => {
                        const rowKey = Object.keys(row).find(k => k.includes(field.name));
                        if (rowKey) mappedRow[field.mappedTo || field.name] = row[rowKey];
                        else if (field.mappedTo) {
                            // Fallback to mapped name if direct field name not found
                            const fallbackKey = Object.keys(row).find(k => k.includes(field.mappedTo!));
                            if (fallbackKey) mappedRow[field.mappedTo!] = row[fallbackKey];
                        }
                    });

                    const invoiceNumber = String(mappedRow["Invoice Number"] || "");
                    const amount = parseFloat(String(mappedRow["Amount"] || 0).replace(/[^\d.-]/g, ''));
                    const vendorCode = String(mappedRow["Vendor/Customer ID"] || "");
                    const invoiceDate = mappedRow["Invoice Date"] instanceof Date ? mappedRow["Invoice Date"] : new Date(mappedRow["Invoice Date"] || Date.now());
                    const companyCode = String(mappedRow["Company Code"] || "1000");

                    if (!invoiceNumber || isNaN(amount)) {
                        errors.push({ row, error: "Invalid data: missing invoice number or amount" });
                        continue;
                    }

                    // Find/Create Vendor
                    let vendorId = "";
                    const [v] = await db.select().from(vendors).where(eq(vendors.vendorCode, vendorCode)).limit(1);
                    if (v) vendorId = v.id;
                    else {
                        const [nv] = await db.insert(vendors).values({
                            name: `Vendor ${vendorCode}`,
                            vendorCode,
                            companyCode,
                            erpType
                        }).returning();
                        vendorId = nv.id;
                    }

                    // Run Detection
                    let maxScore = 0;
                    let matchedId = null;
                    let signalsArr: any[] = [];
                    let matchType: any = "EXACT";

                    for (const candidate of existingBaseline) {
                        const res = detectDuplicate(
                            { invoiceNumber, amount, vendorId, invoiceDate, companyCode },
                            {
                                invoiceNumber: candidate.invoiceNumber,
                                amount: Number(candidate.grossAmount),
                                vendorId: candidate.vendorId,
                                invoiceDate: candidate.invoiceDate as Date,
                                companyCode: candidate.companyCode as string
                            }
                        );
                        if (res.score > maxScore) {
                            maxScore = res.score;
                            matchedId = candidate.id;
                            signalsArr = res.signals;
                            matchType = res.score === 100 ? "EXACT" : "FUZZY";
                        }
                    }

                    const riskLevel = classifyRisk(maxScore, DEFAULT_CONFIG);
                    let lifecycleState = "PAID";
                    if (maxScore >= DEFAULT_CONFIG.mediumThreshold) lifecycleState = "PAID_DUPLICATE";

                    let duplicateGroupIdVal: string | null = null;
                    if (matchedId && maxScore >= DEFAULT_CONFIG.mediumThreshold) {
                        const candidateMatch = existingBaseline.find(c => c.id === matchedId);
                        if (candidateMatch?.duplicateGroupId) {
                            duplicateGroupIdVal = candidateMatch.duplicateGroupId;
                        } else {
                            const [ng] = await db.insert(duplicateGroups).values({
                                primaryInvoiceId: matchedId,
                                matchType,
                                explanationJson: { signals: signalsArr, score: maxScore }
                            }).returning();
                            duplicateGroupIdVal = ng.id;
                            await db.update(invoices).set({ duplicateGroupId: ng.id }).where(eq(invoices.id, matchedId));
                        }
                    }

                    const [newInv] = await db.insert(invoices).values({
                        erpType,
                        companyCode,
                        vendorCode,
                        vendorId,
                        invoiceNumber,
                        invoiceDate,
                        grossAmount: amount.toString(),
                        amount: amount.toString(),
                        currency: String(mappedRow["Currency"] || "USD"),
                        poNumber: String(mappedRow["Purchase Order Number"] || ""),
                        lifecycleState: lifecycleState as any,
                        riskScore: maxScore,
                        riskBand: riskLevel.toUpperCase(),
                        isDuplicateCandidate: maxScore >= DEFAULT_CONFIG.mediumThreshold,
                        confirmedDuplicate: maxScore >= DEFAULT_CONFIG.criticalThreshold,
                        matchedInvoiceId: matchedId,
                        duplicateGroupId: duplicateGroupIdVal,
                        paymentStatus: "PAID",
                        paymentDate: invoiceDate,
                        signals: signalsArr.map(s => JSON.stringify(s)),
                        status: lifecycleState,
                        statusUpdatedBy: userId,
                    }).returning();

                    await db.insert(workflowEvents).values({
                        invoiceId: newInv.id,
                        fromState: "HISTORICAL_IMPORT",
                        toState: lifecycleState,
                        actorUserId: userId,
                        reasonCode: "HISTORICAL_BASELINE_SYNC",
                        notes: `Imported historical record. Score: ${maxScore}%`
                    });

                    results.push(newInv.id);
                } catch (err: any) {
                    errors.push({ row, error: err.message });
                }
            }
        } else if (entityType === "Vendors") {
            for (const row of rawData as any[]) {
                try {
                    const mappedRow: any = {};
                    mapping.forEach(field => {
                        const rowKey = Object.keys(row).find(k => k.includes(field.name));
                        if (rowKey) mappedRow[field.mappedTo || field.name] = row[rowKey];
                        else if (field.mappedTo) {
                            const fallbackKey = Object.keys(row).find(k => k.includes(field.mappedTo!));
                            if (fallbackKey) mappedRow[field.mappedTo!] = row[fallbackKey];
                        }
                    });

                    const [v] = await db.insert(vendors).values({
                        vendorCode: String(mappedRow["Vendor ID"] || ""),
                        name: String(mappedRow["Vendor Name"] || ""),
                        companyCode: String(mappedRow["Company Codes"] || "1000"),
                        taxId: String(mappedRow["Tax ID"] || ""),
                        iban: String(mappedRow["IBAN"] || ""),
                        swiftBic: String(mappedRow["SWIFT/BIC"] || ""),
                        addressLine1: String(mappedRow["Address Line 1"] || mappedRow["Address"] || ""),
                        postalCode: String(mappedRow["Postal Code"] || ""),
                        country: String(mappedRow["Country"] || ""),
                        email: String(mappedRow["Email"] || ""),
                        erpType: erpType
                    }).returning();
                    results.push(v.id);
                } catch (err: any) {
                    errors.push({ row, error: err.message });
                }
            }
        } else if (entityType === "Customers") {
            for (const row of rawData as any[]) {
                try {
                    const mappedRow: any = {};
                    mapping.forEach(field => {
                        const rowKey = Object.keys(row).find(k => k.includes(field.name));
                        if (rowKey) mappedRow[field.mappedTo || field.name] = row[rowKey];
                        else if (field.mappedTo) {
                            const fallbackKey = Object.keys(row).find(k => k.includes(field.mappedTo!));
                            if (fallbackKey) mappedRow[field.mappedTo!] = row[fallbackKey];
                        }
                    });

                    const [c] = await db.insert(customers).values({
                        customerNumber: String(mappedRow["Customer ID"] || ""),
                        name: String(mappedRow["Customer Name"] || ""),
                        taxId: String(mappedRow["Tax ID"] || ""),
                        billingAddress: String(mappedRow["Billing Address"] || mappedRow["Address"] || ""),
                        email: String(mappedRow["Email"] || ""),
                        phone: String(mappedRow["Phone"] || ""),
                        companyCode: String(mappedRow["Company Codes"] || "1000")
                    }).returning();
                    results.push(c.id);
                } catch (err: any) {
                    errors.push({ row, error: err.message });
                }
            }
        }

        await db.update(uploadBatches).set({
            status: errors.length > 0 ? (results.length > 0 ? "partial" : "failed") : "completed",
            errorRows: errors.length
        }).where(eq(uploadBatches.id, batch.id));

        return NextResponse.json({
            success: true,
            batchId: batch.id,
            processedCount: results.length,
            errors: errors.length
        });

    } catch (error: any) {
        console.error("Historical Upload Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
