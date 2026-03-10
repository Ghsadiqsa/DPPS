import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, dppsConfig } from "@/lib/schema";
import { sql, and, gte, lte, eq } from "drizzle-orm";
import { convertCurrency } from "@/lib/currency";
import { format } from "date-fns";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
    try {
        // 1. Fetch Config for currency preferences (Safely)
        let reportingCurrency = 'USD';
        let showSideBySide = false;
        try {
            const [config] = await db.select().from(dppsConfig).where(eq(dppsConfig.id, 'default'));
            if (config) {
                reportingCurrency = (config as any).reportingCurrency || 'USD';
                showSideBySide = (config as any).showSideBySideAmounts || false;
            }
        } catch (e) {
            console.warn("API Dashboard: Database column mismatch - defaulting to USD.");
        }

        const { searchParams } = new URL(request.url);

        // 1. Extract Global Filters
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const erpType = searchParams.get("erpType");
        const companyCode = searchParams.get("companyCode");
        const currency = searchParams.get("currency"); // do NOT default to USD — proposals may be EUR, GBP etc.

        // 2. Build Base Conditions
        const conditions = [];
        if (startDate) conditions.push(gte(invoices.createdAt, new Date(startDate)));
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            conditions.push(lte(invoices.createdAt, end));
        }
        if (erpType && erpType !== "all") conditions.push(eq(invoices.erpType, erpType));
        if (companyCode && companyCode !== "all") conditions.push(eq(invoices.companyCode, companyCode));
        if (currency && currency !== "all") conditions.push(eq(invoices.currency, currency));

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // 3. CFO-Grade Currency-Aware Aggregations
        const invoicesData = await db.select({
            grossAmount: invoices.grossAmount,
            currency: invoices.currency,
            lifecycleState: invoices.lifecycleState,
            isDuplicateCandidate: invoices.isDuplicateCandidate,
            createdAt: invoices.createdAt
        })
            .from(invoices)
            .where(whereClause);

        const totalVolume = invoicesData.length;
        let totalVal_Base = 0;
        let expVal_Base = 0, expCount = 0;
        let prevVal_Base = 0, prevCount = 0;
        let leakVal_Base = 0, leakCount = 0;
        let recVal_Base = 0, recCount = 0;

        invoicesData.forEach(inv => {
            const val_Base = convertCurrency(Number(inv.grossAmount), inv.currency || 'USD', reportingCurrency);
            totalVal_Base += val_Base;

            // 3a. Metrics Buckets (Auditor Precision)
            // An "Open Exposure" is an invoice that is flagged or in investigation,
            // OR any duplicate candidate that hasn't been finalized (Confirmed, Cleared, Recovered, etc.)
            const resolvedStates = ['CONFIRMED_DUPLICATE', 'RECOVERY_OPENED', 'RECOVERY_RESOLVED', 'NOT_DUPLICATE', 'CLEARED', 'READY_FOR_RELEASE', 'RELEASED_TO_PAYMENT'];
            const isOpenExposure = ['FLAGGED_HIGH', 'FLAGGED_MEDIUM', 'FLAGGED_LOW', 'IN_INVESTIGATION'].includes(inv.lifecycleState || '') ||
                (inv.isDuplicateCandidate && !resolvedStates.includes(inv.lifecycleState || ''));

            if (isOpenExposure) {
                expCount++;
                expVal_Base += val_Base;
            }

            if (inv.lifecycleState === 'CONFIRMED_DUPLICATE') {
                prevCount++;
                prevVal_Base += val_Base;
            }

            if (inv.lifecycleState === 'RECOVERY_OPENED') {
                leakCount++;
                leakVal_Base += val_Base;
            }

            if (inv.lifecycleState === 'RECOVERY_RESOLVED') {
                recCount++;
                recVal_Base += val_Base;
            }
        });

        // 4. Trend Data Generation (Aggregated by Month)
        const trendMap = new Map<string, { month: string; prevented: number; leakage: number }>();
        invoicesData.forEach(inv => {
            const date = inv.createdAt ? new Date(inv.createdAt) : new Date();
            const monthKey = format(date, 'MMM yyyy');
            const val_Base = convertCurrency(Number(inv.grossAmount), inv.currency || 'USD', reportingCurrency);

            const existing = trendMap.get(monthKey) || { month: monthKey, prevented: 0, leakage: 0 };

            if (inv.lifecycleState === 'CONFIRMED_DUPLICATE') {
                existing.prevented += val_Base;
            }
            if (['RECOVERY_OPENED', 'RECOVERY_RESOLVED'].includes(inv.lifecycleState || '')) {
                existing.leakage += val_Base;
            }

            trendMap.set(monthKey, existing);
        });

        const trend = Array.from(trendMap.values()).sort((a, b) => {
            const da = new Date(a.month), db = new Date(b.month);
            return da.getTime() - db.getTime();
        });

        // 5. Workflow State Funnel (Reconciled with Currency)
        const workflowRaw = await db.select({
            state: invoices.lifecycleState,
            count: sql<number>`count(*)`,
            value: sql<number>`sum(gross_amount)` // This sum is mixed, but we use it only as a count anchor and then convert below
        })
            .from(invoices)
            .where(whereClause)
            .groupBy(invoices.lifecycleState);

        const workflow = workflowRaw.map(w => {
            // Note: For a truly perfect funnel value, we'd need to convert individual items, 
            // but for the funnel viz, a rough sum converted is often acceptable or we re-aggregate.
            // Let's re-aggregate precisely from our invoicesData for funnel too.
            const stateValue = invoicesData
                .filter(i => i.lifecycleState === w.state)
                .reduce((acc, current) => acc + convertCurrency(Number(current.grossAmount), current.currency || 'USD', reportingCurrency), 0);

            return {
                state: w.state || 'UNKNOWN',
                count: Number(w.count || 0),
                value: stateValue
            };
        });

        // 6. Risk Concentration (Precise Currency)
        const riskQuery = await db.select({
            vendor_code: invoices.vendorCode,
            total_value: invoices.grossAmount, // Select raw grossAmount
            currency: invoices.currency,
            risk_band: invoices.riskBand
        })
            .from(invoices)
            .where(whereClause);

        const riskConcentrationMap = new Map<string, { vendor_code: string; total_value: number; risk_band: string | null }>();

        riskQuery.forEach(r => {
            const baseValue = convertCurrency(Number(r.total_value), r.currency || 'USD', reportingCurrency);
            const key = `${r.vendor_code}-${r.risk_band}`; // Group by vendor and risk band

            const existing = riskConcentrationMap.get(key);
            if (existing) {
                existing.total_value += baseValue;
            } else {
                riskConcentrationMap.set(key, {
                    vendor_code: r.vendor_code,
                    total_value: baseValue,
                    risk_band: r.risk_band
                });
            }
        });

        // Convert map values to array, sort, and take top 5
        const riskConcentration = Array.from(riskConcentrationMap.values())
            .sort((a, b) => b.total_value - a.total_value)
            .slice(0, 5);

        // 7. Performance Ratios
        const dupeRate = totalVolume > 0 ? (expCount / totalVolume) * 100 : 0;
        const prevEff = expCount > 0 ? (prevCount / expCount) * 100 : 0;
        const leakRate = totalVolume > 0 ? (leakCount / totalVolume) * 100 : 0;
        const recRate = leakVal_Base > 0 ? (recVal_Base / leakVal_Base) * 100 : 0;

        return NextResponse.json({
            hero: {
                exposureAtRisk: { value: expVal_Base, count: expCount },
                prevented: { value: prevVal_Base, count: prevCount },
                leakage: { value: leakVal_Base, count: leakCount },
                netProtectedImpact: { value: prevVal_Base + recVal_Base, count: prevCount + recCount }
            },
            scorecard: {
                duplicateRate: dupeRate,
                preventionEffectiveness: prevEff,
                leakageRate: leakRate,
                recoveryEffectiveness: recRate,
                totalCheckedValue: totalVal_Base,
                totalCheckedCount: totalVolume,
                baseCurrency: reportingCurrency
            },
            workflow,
            trend,
            riskConcentration,
            metadata: {
                reconciledAt: new Date().toISOString(),
                reportingCurrency,
                showSideBySideAmounts: showSideBySide
            }
        });

    } catch (error: any) {
        logger.error({
            message: "Dashboard Summary Reboot Failure",
            action: "DASHBOARD_SUMMARY",
            error
        });
        return NextResponse.json({ error: "Aggregator failure", details: error.message }, { status: 500 });
    }
}
