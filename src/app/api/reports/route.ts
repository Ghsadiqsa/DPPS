import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
    try {
        // All queries use `lifecycle_state` (the current schema field) and `gross_amount`
        // ── 1. Summary KPIs ────────────────────────────────────────────────────────
        const kpiResult: any = await db.execute(sql`
            SELECT
                COUNT(*) as total_processed,
                COALESCE(SUM(gross_amount), 0) as total_value,

                -- Active Flags: flagged or under investigation
                COUNT(*) FILTER (WHERE lifecycle_state IN (
                    'FLAGGED_HIGH','FLAGGED_MEDIUM','FLAGGED_LOW','IN_INVESTIGATION'
                ) OR (is_duplicate_candidate = true AND lifecycle_state NOT IN ('CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'CLEARED', 'READY_FOR_RELEASE', 'RELEASED_TO_PAYMENT', 'PAID', 'RECOVERY_OPENED', 'RECOVERY_RESOLVED'))) as exposure_count,
                COALESCE(SUM(gross_amount) FILTER (WHERE lifecycle_state IN (
                    'FLAGGED_HIGH','FLAGGED_MEDIUM','FLAGGED_LOW','IN_INVESTIGATION'
                ) OR (is_duplicate_candidate = true AND lifecycle_state NOT IN ('CONFIRMED_DUPLICATE', 'NOT_DUPLICATE', 'CLEARED', 'READY_FOR_RELEASE', 'RELEASED_TO_PAYMENT', 'PAID', 'RECOVERY_OPENED', 'RECOVERY_RESOLVED'))), 0) as exposure_value,

                -- Prevented: stopped before payment
                COUNT(*) FILTER (WHERE lifecycle_state = 'CONFIRMED_DUPLICATE') as prevented_count,
                COALESCE(SUM(gross_amount) FILTER (WHERE lifecycle_state = 'CONFIRMED_DUPLICATE'), 0) as prevented_value,

                -- In Investigation (Open Tasks)
                COUNT(*) FILTER (WHERE lifecycle_state = 'IN_INVESTIGATION') as open_tasks,

                -- Released to Payment
                COUNT(*) FILTER (WHERE lifecycle_state IN ('RELEASED_TO_PAYMENT','PAID')) as released_count,
                COALESCE(SUM(gross_amount) FILTER (WHERE lifecycle_state IN ('RELEASED_TO_PAYMENT','PAID')), 0) as released_value,

                -- Recovery
                COUNT(*) FILTER (WHERE lifecycle_state = 'RECOVERY_OPENED') as recovery_open_count,
                COALESCE(SUM(gross_amount) FILTER (WHERE lifecycle_state = 'RECOVERY_OPENED'), 0) as recovery_open_value,
                COUNT(*) FILTER (WHERE lifecycle_state = 'RECOVERY_RESOLVED') as recovered_count,
                COALESCE(SUM(gross_amount) FILTER (WHERE lifecycle_state = 'RECOVERY_RESOLVED'), 0) as recovered_value,

                -- Avg risk score on flagged items
                COALESCE(AVG(risk_score) FILTER (WHERE is_duplicate_candidate = true AND risk_score > 0), 0) as avg_risk_score

            FROM invoices
        `);

        const row = kpiResult.rows?.[0] || {};
        const totalProcessed = Number(row.total_processed || 0);
        const totalValue = Number(row.total_value || 0);
        const exposureCount = Number(row.exposure_count || 0);
        const exposureValue = Number(row.exposure_value || 0);
        const preventedCount = Number(row.prevented_count || 0);
        const preventedValue = Number(row.prevented_value || 0);
        const openTasks = Number(row.open_tasks || 0);
        const releasedCount = Number(row.released_count || 0);
        const releasedValue = Number(row.released_value || 0);
        const recoveryOpenValue = Number(row.recovery_open_value || 0);
        const recoveredValue = Number(row.recovered_value || 0);
        const avgRiskScore = parseFloat(Number(row.avg_risk_score || 0).toFixed(1));

        const totalRecoveryVolume = recoveredValue + recoveryOpenValue;
        const successRate = totalRecoveryVolume > 0
            ? parseFloat(((recoveredValue / totalRecoveryVolume) * 100).toFixed(1))
            : 0;

        // ── 2. Daily trend (last 7 days by invoice date) ───────────────────────────
        const dailyResult: any = await db.execute(sql`
            SELECT
                TO_CHAR(created_at, 'Dy') as name,
                EXTRACT(DOW FROM created_at) as dow,
                COALESCE(SUM(gross_amount) FILTER (WHERE lifecycle_state = 'CONFIRMED_DUPLICATE'), 0) as prevented,
                COALESCE(SUM(gross_amount) FILTER (WHERE is_duplicate_candidate = true), 0) as detected
            FROM invoices
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY TO_CHAR(created_at, 'Dy'), EXTRACT(DOW FROM created_at)
            ORDER BY EXTRACT(DOW FROM created_at)
        `);
        const monthlyData = (dailyResult.rows || []).map((r: any) => ({
            name: r.name,
            prevented: Number(r.prevented),
            detected: Number(r.detected)
        }));

        // ── 3. Detection type breakdown from rulesTriggered in match_candidates ────
        const rulesResult: any = await db.execute(sql`
            SELECT
                jsonb_object_keys(rules_triggered) as rule,
                COUNT(*) as rule_count
            FROM match_candidates
            WHERE rules_triggered IS NOT NULL
            GROUP BY jsonb_object_keys(rules_triggered)
            ORDER BY COUNT(*) DESC
            LIMIT 10
        `);
        const colors = ["#3498db", "#f39c12", "#e74c3c", "#9b59b6", "#2ecc71", "#e67e22", "#1abc9c", "#c0392b", "#16a085", "#8e44ad"];
        const categoryData = (rulesResult.rows || []).map((c: any, i: number) => ({
            name: c.rule.replace(/_/g, ' '),
            value: Number(c.rule_count),
            color: colors[i % colors.length]
        }));

        // ── 4. Resolved summary ─────────────────────────────────────────────────────
        const resolvedSummary = {
            released: { count: releasedCount, amount: releasedValue },
            notDuplicate: { count: preventedCount, amount: preventedValue },
            confirmedDuplicate: { count: exposureCount, amount: exposureValue },
        };

        // ── 5. Recent activity (all lifecycle statuses) ─────────────────
        const recentResult: any = await db.execute(sql`
            SELECT
                i.invoice_number,
                i.gross_amount as amount,
                i.lifecycle_state as status,
                v.name as vendor_name,
                i.updated_at as created_at
            FROM invoices i
            LEFT JOIN vendors v ON v.id = i.vendor_id
            WHERE i.lifecycle_state IS NOT NULL
            ORDER BY i.updated_at DESC
            LIMIT 50
        `);
        const recentActivity = (recentResult.rows || []).map((r: any) => ({
            invoiceNumber: r.invoice_number,
            amount: Number(r.amount),
            status: r.status,
            vendorName: r.vendor_name || 'Unknown',
            createdAt: r.created_at,
        }));

        // ── 6. Lifecycle state funnel ───────────────────────────────────────────────
        const funnelResult: any = await db.execute(sql`
            SELECT lifecycle_state as state,
                   COUNT(*) as count,
                   COALESCE(SUM(gross_amount), 0) as value
            FROM invoices
            GROUP BY lifecycle_state
            ORDER BY COUNT(*) DESC
        `);
        const funnelData = (funnelResult.rows || []).map((r: any) => ({
            state: r.state,
            count: Number(r.count),
            value: Number(r.value)
        }));

        return NextResponse.json({
            kpi: {
                prevented: preventedValue,
                successRate,
                confidenceAvg: avgRiskScore,
                detectedRisks: exposureCount,
                openTasks,
                totalProcessed,
                totalProcessedValue: totalValue,
                totalAtRisk: exposureValue,
                totalRecovered: recoveredValue,
                totalOpenRecovery: recoveryOpenValue,
                preventedCount,
                releasedCount,
            },
            monthlyData,
            categoryData,
            resolvedSummary,
            recentActivity,
            funnelData,
        });

    } catch (error) {
        console.error('Failed to fetch reports:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
