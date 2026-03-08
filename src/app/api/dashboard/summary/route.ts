import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices } from "@/lib/schema";
import { sql, and, gte, lte, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // 1. Extract Global Filters
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const erpType = searchParams.get("erpType");
        const companyCode = searchParams.get("companyCode");
        const currency = searchParams.get("currency"); // do NOT default to USD — proposals may be EUR, GBP etc.

        // 2. Build Base Conditions
        const conditions = [];
        if (startDate) conditions.push(gte(invoices.invoiceDate, new Date(startDate)));
        if (endDate) conditions.push(lte(invoices.invoiceDate, new Date(endDate)));
        if (erpType && erpType !== "all") conditions.push(eq(invoices.erpType, erpType));
        if (companyCode && companyCode !== "all") conditions.push(eq(invoices.companyCode, companyCode));
        if (currency && currency !== "all") conditions.push(eq(invoices.currency, currency));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // 3. CFO-Grade KPI Aggregations
        // Active Flags = any invoice that the detection engine has flagged as a potential duplicate
        // (includes items currently under investigation AND confirmed duplicates)
        // Verified Savings = invoices cleared as NOT_DUPLICATE (Force Clear) or moved to READY_FOR_RELEASE
        const statsQuery = db.select({
            totalVolume: sql<number>`count(*)`,
            totalValue: sql<number>`sum(gross_amount)`,

            // Exposure At Risk: all flagged and under-review potential duplicates
            exposureCount: sql<number>`count(*) filter (where lifecycle_state in ('FLAGGED_HIGH', 'FLAGGED_MEDIUM', 'FLAGGED_LOW', 'IN_INVESTIGATION', 'CONFIRMED_DUPLICATE') OR is_duplicate_candidate = true)`,
            exposureValue: sql<number>`sum(gross_amount) filter (where lifecycle_state in ('FLAGGED_HIGH', 'FLAGGED_MEDIUM', 'FLAGGED_LOW', 'IN_INVESTIGATION', 'CONFIRMED_DUPLICATE') OR is_duplicate_candidate = true)`,

            // Capital Prevented: duplicates that were stopped before payment (confirmed + cleared)
            preventedCount: sql<number>`count(*) filter (where lifecycle_state in ('CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'READY_FOR_RELEASE'))`,
            preventedValue: sql<number>`sum(gross_amount) filter (where lifecycle_state in ('CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'READY_FOR_RELEASE'))`,

            leakageCount: sql<number>`count(*) filter (where lifecycle_state in ('RECOVERY_OPENED', 'RECOVERY_RESOLVED'))`,
            leakageValue: sql<number>`sum(gross_amount) filter (where lifecycle_state in ('RECOVERY_OPENED', 'RECOVERY_RESOLVED'))`,

            recoveredCount: sql<number>`count(*) filter (where lifecycle_state = 'RECOVERY_RESOLVED')`,
            recoveredValue: sql<number>`sum(gross_amount) filter (where lifecycle_state = 'RECOVERY_RESOLVED')`,
        })
            .from(invoices)
            .where(whereClause);

        const [rawStats] = await statsQuery;

        // 4. Trend Data Generation (Cleared for empty application state)
        const trend: any[] = [];

        // 5. Workflow State Funnel (Reconciled)
        const workflowQuery = db.select({
            state: invoices.lifecycleState,
            count: sql<number>`count(*)`,
            value: sql<number>`sum(gross_amount)`
        })
            .from(invoices)
            .where(whereClause)
            .groupBy(invoices.lifecycleState);

        const workflowRaw = await workflowQuery;
        const workflow = workflowRaw.map(w => ({
            state: w.state || 'UNKNOWN',
            count: Number(w.count || 0),
            value: Number(w.value || 0)
        }));

        // 6. Risk Concentration (Top Vendors)
        const riskQuery = db.select({
            vendor_code: invoices.vendorCode,
            total_value: sql<number>`sum(gross_amount)`,
            risk_band: invoices.riskBand
        })
            .from(invoices)
            .where(whereClause)
            .groupBy(invoices.vendorCode, invoices.riskBand)
            .orderBy(sql`sum(gross_amount) DESC`)
            .limit(5);

        const riskConcentration = await riskQuery;

        // 7. Performance Ratios
        const totalVolume = Number(rawStats.totalVolume || 0);
        const exposureValue = Number(rawStats.exposureValue || 0);
        const preventedValue = Number(rawStats.preventedValue || 0);
        const leakageValue = Number(rawStats.leakageValue || 0);
        const recoveredValue = Number(rawStats.recoveredValue || 0);

        const dupeRate = totalVolume > 0 ? (Number(rawStats.exposureCount) / totalVolume) * 100 : 0;
        const prevEff = Number(rawStats.exposureCount) > 0 ? (Number(rawStats.preventedCount) / Number(rawStats.exposureCount)) * 100 : 0;
        const leakRate = totalVolume > 0 ? (Number(rawStats.leakageCount) / totalVolume) * 100 : 0;
        const recRate = leakageValue > 0 ? (recoveredValue / leakageValue) * 100 : 0;

        return NextResponse.json({
            hero: {
                exposureAtRisk: { value: exposureValue, count: Number(rawStats.exposureCount) },
                prevented: { value: preventedValue, count: Number(rawStats.preventedCount) },
                leakage: { value: leakageValue, count: Number(rawStats.leakageCount) },
                netProtectedImpact: { value: preventedValue + recoveredValue, count: Number(rawStats.preventedCount + rawStats.recoveredCount) }
            },
            scorecard: {
                duplicateRate: dupeRate,
                preventionEffectiveness: prevEff,
                leakageRate: leakRate,
                recoveryEffectiveness: recRate,
                totalCheckedValue: Number(rawStats.totalValue || 0),
                totalCheckedCount: totalVolume
            },
            workflow,
            trend,
            riskConcentration: riskConcentration.map(r => ({
                ...r,
                total_value: Number(r.total_value || 0)
            })),
            metadata: { reconciledAt: new Date().toISOString() }
        });

    } catch (error: any) {
        console.error("Dashboard Summary Reboot Failure:", error);
        return NextResponse.json({ error: "Aggregator failure", details: error.message }, { status: 500 });
    }
}
