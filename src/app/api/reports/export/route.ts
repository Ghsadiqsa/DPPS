import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, and, eq, gte, lte, or, ilike } from "drizzle-orm";
import { invoices, vendors } from "@/lib/schema";
import * as XLSX from "xlsx";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { filters: f } = body;

        // Building dynamic filter logic (shared with GET /api/invoices)
        const filters = [];
        if (f.erpType) filters.push(eq(invoices.erpType, f.erpType));
        if (f.companyCode) filters.push(eq(invoices.companyCode, f.companyCode));
        if (f.vendorCode) filters.push(eq(invoices.vendorCode, f.vendorCode));
        if (f.currency) filters.push(eq(invoices.currency, f.currency));
        if (f.lifecycleState) filters.push(eq(invoices.lifecycleState, f.lifecycleState));
        if (f.riskBand) filters.push(eq(invoices.riskBand, f.riskBand));

        if (f.startDate) filters.push(gte(invoices.invoiceDate, new Date(f.startDate)));
        if (f.endDate) filters.push(lte(invoices.invoiceDate, new Date(f.endDate)));

        if (f.search) {
            filters.push(or(
                ilike(invoices.invoiceNumber, `%${f.search}%`),
                ilike(invoices.vendorCode, `%${f.search}%`)
            ));
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

        // 1. Fetch data for export
        const data = await db.select({
            "ERP Type": invoices.erpType,
            "Company Code": invoices.companyCode,
            "Vendor Code": invoices.vendorCode,
            "Vendor Name": vendors.name,
            "Invoice Number": invoices.invoiceNumber,
            "Invoice Date": invoices.invoiceDate,
            "Gross Amount": invoices.grossAmount,
            "Currency": invoices.currency,
            "PO Number": invoices.poNumber,
            "Status": invoices.lifecycleState,
            "Risk Score": invoices.riskScore,
            "Risk Band": invoices.riskBand,
            "Payment Status": invoices.paymentStatus,
            "Payment Date": invoices.paymentDate
        })
            .from(invoices)
            .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
            .where(whereClause)
            .limit(10000); // Audit limit

        if (data.length === 0) {
            return NextResponse.json({ error: "No data found for the selected filters." }, { status: 404 });
        }

        // 2. Generate XLSX
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "DPPS Audit Export");

        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        return new NextResponse(buf, {
            status: 200,
            headers: {
                "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "Content-Disposition": `attachment; filename="DPPS_Audit_Export_${new Date().toISOString().split('T')[0]}.xlsx"`
            }
        });

    } catch (error: any) {
        console.error("Export API Error:", error);
        return NextResponse.json({ error: "Failed to generate report export." }, { status: 500 });
    }
}
