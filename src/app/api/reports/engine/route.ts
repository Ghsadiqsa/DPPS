import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, and, eq, gte, lte, or, ilike, inArray } from "drizzle-orm";
import { invoices, vendors } from "@/lib/schema";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { filters: f, pagination: p } = body;

        // 1. Unified Filter Logic (Enterprise-grade)
        const filters = [];
        if (f.erpType && f.erpType !== "all") filters.push(eq(invoices.erpType, f.erpType));
        if (f.companyCode && f.companyCode !== "all") filters.push(eq(invoices.companyCode, f.companyCode));
        if (f.vendorCode) filters.push(eq(invoices.vendorCode, f.vendorCode));
        if (f.currency && f.currency !== "all") filters.push(eq(invoices.currency, f.currency));

        if (f.statuses && f.statuses.length > 0) {
            filters.push(inArray(invoices.lifecycleState, f.statuses));
        }
        if (f.riskBands && f.riskBands.length > 0) {
            filters.push(inArray(invoices.riskBand, f.riskBands));
        }

        if (f.dateRange?.from) filters.push(gte(invoices.invoiceDate, new Date(f.dateRange.from)));
        if (f.dateRange?.to) filters.push(lte(invoices.invoiceDate, new Date(f.dateRange.to)));

        if (f.search) {
            filters.push(or(
                ilike(invoices.invoiceNumber, `%${f.search}%`),
                ilike(invoices.vendorCode, `%${f.search}%`)
            ));
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

        // 2. High-Performance Aggregated Metrics (CFO-reconciled)
        const summaryResult: any = await db.execute(sql`
            SELECT
                count(*) as total_checked,
                sum(gross_amount) as total_value,
                count(*) filter (where lifecycle_state = 'BLOCKED') as prevented_count,
                sum(gross_amount) filter (where lifecycle_state = 'BLOCKED') as prevented_value,
                count(*) filter (where lifecycle_state in ('PAID_DUPLICATE', 'RECOVERY')) as leakage_count,
                sum(gross_amount) filter (where lifecycle_state in ('PAID_DUPLICATE', 'RECOVERY')) as leakage_value,
                count(*) filter (where lifecycle_state = 'RESOLVED') as recovered_count,
                sum(gross_amount) filter (where lifecycle_state = 'RESOLVED') as recovered_value,
                avg(risk_score) as avg_risk
            FROM invoices
            ${whereClause ? sql`WHERE ${whereClause}` : sql``}
        `);

        const s = summaryResult.rows[0];
        const totalChecked = Number(s.total_checked || 0);
        const leakageValue = Number(s.leakage_value || 0);
        const recoveredValue = Number(s.recovered_value || 0);

        // 3. Paginated Transaction Detail
        const limit = p?.limit || 25;
        const offset = ((p?.page || 1) - 1) * limit;

        const detailedData = await db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            vendorCode: invoices.vendorCode,
            vendorName: vendors.name,
            invoiceDate: invoices.invoiceDate,
            amount: invoices.grossAmount,
            currency: invoices.currency,
            riskBand: invoices.riskBand,
            riskScore: invoices.riskScore,
            status: invoices.lifecycleState,
            updatedAt: invoices.updatedAt
        })
            .from(invoices)
            .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
            .where(whereClause)
            .limit(limit)
            .offset(offset)
            .orderBy(sql`${invoices.invoiceDate} DESC`);

        return NextResponse.json({
            summary: {
                totalChecked: totalChecked,
                totalValue: Number(s.total_value || 0),
                prevented: { count: Number(s.prevented_count || 0), value: Number(s.prevented_value || 0) },
                leakage: { count: Number(s.leakage_count || 0), value: leakageValue },
                recovered: { count: Number(s.recovered_count || 0), value: recoveredValue },

                leakageRate: totalChecked > 0 ? (Number(s.leakage_count) / totalChecked) * 100 : 0,
                recoveryEfficiency: leakageValue > 0 ? (recoveredValue / leakageValue) * 100 : 0,
                avgRiskScore: Number(s.avg_risk || 0).toFixed(1)
            },
            data: detailedData,
            pagination: {
                total: totalChecked,
                page: p?.page || 1,
                pages: Math.ceil(totalChecked / limit)
            },
            reconciledAt: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("Reports Engine (Hardened) Cluster Failure:", error);
        return NextResponse.json({ error: "Data cluster unreachable", details: error.message }, { status: 500 });
    }
}
