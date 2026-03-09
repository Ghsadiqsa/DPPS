import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, and, eq, gte, lte, or, ilike, inArray } from "drizzle-orm";
import { invoices, vendors, dppsConfig } from "@/lib/schema";

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

        // 2. Data Fetch & Base Summarization
        // To be mathematically correct with multi-currency, we calculate in JS
        const allFilteredInvoices = await db.select({
            grossAmount: invoices.grossAmount,
            currency: invoices.currency,
            lifecycleState: invoices.lifecycleState,
            riskScore: invoices.riskScore,
        })
            .from(invoices)
            .where(whereClause);

        // Fetch Config for currency preferences (Safely)
        let reportingCurrency = 'USD';
        let showSideBySide = false;
        try {
            const [config] = await db.select().from(dppsConfig).where(eq(dppsConfig.id, 'default'));
            if (config) {
                reportingCurrency = (config as any).reportingCurrency || 'USD';
                showSideBySide = (config as any).showSideBySideAmounts || false;
            }
        } catch (e) {
            console.warn("API: Database schema mismatch on reportingCurrency - using defaults.");
        }

        const { convertCurrency } = await import("@/lib/currency");

        // CFO-Grade JS Aggregation
        let totalChecked = allFilteredInvoices.length;
        let totalVal_Base = 0;
        let pCount = 0, pVal_Base = 0;
        let lCount = 0, lVal_Base = 0;
        let rCount = 0, rVal_Base = 0;
        let riskSum = 0;

        allFilteredInvoices.forEach(inv => {
            const amount_Base = convertCurrency(Number(inv.grossAmount), inv.currency || 'USD', reportingCurrency);
            totalVal_Base += amount_Base;
            riskSum += Number(inv.riskScore || 0);

            if (inv.lifecycleState === 'CONFIRMED_DUPLICATE') {
                pCount++;
                pVal_Base += amount_Base;
            }
            if (['RECOVERY_OPENED', 'RECOVERY_RESOLVED'].includes(inv.lifecycleState || '')) {
                lCount++;
                lVal_Base += amount_Base;
            }
            if (inv.lifecycleState === 'RECOVERY_RESOLVED') {
                rCount++;
                rVal_Base += amount_Base;
            }
        });

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
                totalValue: totalVal_Base,
                prevented: { count: pCount, value: pVal_Base },
                leakage: { count: lCount, value: lVal_Base },
                recovered: { count: rCount, value: rVal_Base },

                leakageRate: totalChecked > 0 ? (lCount / totalChecked) * 100 : 0,
                recoveryEfficiency: lVal_Base > 0 ? (rVal_Base / lVal_Base) * 100 : 0,
                avgRiskScore: totalChecked > 0 ? (riskSum / totalChecked).toFixed(1) : "0.0",
                reportingCurrency
            },
            data: detailedData.map(item => ({
                ...item,
                amountInReportingCurrency: convertCurrency(Number(item.amount), item.currency || 'USD', reportingCurrency)
            })),
            pagination: {
                total: totalChecked,
                page: p?.page || 1,
                pages: Math.ceil(totalChecked / limit)
            },
            metadata: {
                reconciledAt: new Date().toISOString(),
                reportingCurrency,
                showSideBySideAmounts: showSideBySide
            }
        });

    } catch (error: any) {
        console.error("Reports Engine (Hardened) Cluster Failure:", error);
        return NextResponse.json({ error: "Data cluster unreachable", details: error.message }, { status: 500 });
    }
}
