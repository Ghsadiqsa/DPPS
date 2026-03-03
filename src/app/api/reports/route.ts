import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';
import { convertCurrency } from '@/lib/currency';

export async function GET() {
    try {
        // 1. Total Prevented: Absolute total of auto-flagged and confirmed duplicates
        const autoFlaggedResult: any = await db.execute(sql`
            SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'AUTO_FLAGGED'
        `);
        const confirmedDupResult: any = await db.execute(sql`
            SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status IN ('BLOCKED', 'RECOVERY_REQUIRED', 'PAID_DUPLICATE')
        `);

        const autoFlaggedAmount = Number(autoFlaggedResult.rows?.[0]?.total || 0);
        const confirmedDupAmount = Number(confirmedDupResult.rows?.[0]?.total || 0);
        const totalPrevented = autoFlaggedAmount + confirmedDupAmount;

        // 2. Total Detected count
        const detectedResult: any = await db.execute(sql`
            SELECT COUNT(*) as count FROM invoices WHERE is_duplicate = true
        `);
        const totalDetectedCount = Number(detectedResult.rows?.[0]?.count || 0);

        // 2b. Open Tasks: Only invoices actually pending review (matches Open Potential Duplicates tab)
        const openTasksResult: any = await db.execute(sql`
            SELECT COUNT(*) as count FROM invoices WHERE status IN ('UNDER_INVESTIGATION', 'AUTO_FLAGGED')
        `);
        const openTasks = Number(openTasksResult.rows?.[0]?.count || 0);

        // 3. Total Processed count & value
        const processedResult: any = await db.execute(sql`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM invoices
        `);
        const totalProcessed = Number(processedResult.rows?.[0]?.count || 0);
        const totalProcessedValue = Number(processedResult.rows?.[0]?.total_value || 0);

        // 4. Recovery Efficiency (Amount Recovered vs Total Recovery Needed)
        const recoveredResult: any = await db.execute(sql`
            SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'RECOVERED'
        `);
        const openRecoveryResult: any = await db.execute(sql`
            SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE status = 'RECOVERY_REQUIRED'
        `);
        const totalRecovered = Number(recoveredResult.rows?.[0]?.total || 0);
        const totalOpenRecovery = Number(openRecoveryResult.rows?.[0]?.total || 0);
        const totalRecoveryVolume = totalRecovered + totalOpenRecovery;
        const successRate = totalRecoveryVolume > 0 ? parseFloat(((totalRecovered / totalRecoveryVolume) * 100).toFixed(1)) : 0;

        // 5. Average Confidence
        const avgScoreResult: any = await db.execute(sql`
            SELECT COALESCE(AVG(similarity_score), 0) as avg_score FROM invoices WHERE is_duplicate = true AND similarity_score > 0
        `);
        const confidenceAvg = parseFloat(Number(avgScoreResult.rows?.[0]?.avg_score || 0).toFixed(1));

        // 6. Daily Data (last 7 days)
        const dailyResult: any = await db.execute(sql`
            SELECT 
                TO_CHAR(created_at, 'Dy') as name,
                SUM(CASE WHEN status IN ('held', 'AUTO_FLAGGED', 'BLOCKED') THEN amount ELSE 0 END) as prevented,
                SUM(CASE WHEN is_duplicate = true THEN amount ELSE 0 END) as detected
            FROM invoices
            WHERE created_at > NOW() - INTERVAL '7 days'
            GROUP BY TO_CHAR(created_at, 'Dy'), EXTRACT(DOW FROM created_at)
            ORDER BY EXTRACT(DOW FROM created_at)
        `);
        const dailyRows = dailyResult.rows || [];
        const monthlyData = dailyRows.map((r: any) => ({
            name: r.name,
            prevented: Number(r.prevented),
            detected: Number(r.detected)
        }));

        // 7. Category Data (detection signal breakdown)
        const categoryResult: any = await db.execute(sql`
            SELECT 
                UNNEST(signals) as name,
                COUNT(*) as value
            FROM invoices
            WHERE is_duplicate = true AND array_length(signals, 1) > 0
            GROUP BY UNNEST(signals)
            ORDER BY COUNT(*) DESC
        `);
        const colors = ["#3498db", "#f39c12", "#e74c3c", "#9b59b6", "#2ecc71", "#e67e22", "#1abc9c"];
        const categoryData = (categoryResult.rows || []).map((c: any, i: number) => ({
            name: c.name,
            value: Number(c.value),
            color: colors[i % colors.length]
        }));

        // 8. Resolved Summary — counts and amounts for duplicates and non-duplicates
        const resolvedResult: any = await db.execute(sql`
            SELECT
                COUNT(*) FILTER (WHERE status = 'CLEARED') as released_count,
                COALESCE(SUM(amount) FILTER (WHERE status = 'CLEARED'), 0) as released_amount,
                COUNT(*) FILTER (WHERE status = 'UPLOADED' AND is_duplicate = false) as not_duplicate_count,
                COALESCE(SUM(amount) FILTER (WHERE status = 'UPLOADED' AND is_duplicate = false), 0) as not_duplicate_amount,
                COUNT(*) FILTER (WHERE status IN ('BLOCKED', 'RECOVERY_REQUIRED', 'PAID_DUPLICATE')) as confirmed_dup_count,
                COALESCE(SUM(amount) FILTER (WHERE status IN ('BLOCKED', 'RECOVERY_REQUIRED', 'PAID_DUPLICATE')), 0) as confirmed_dup_amount
            FROM invoices
        `);
        const rr = resolvedResult.rows?.[0] || resolvedResult[0] || {};
        const resolvedSummary = {
            released: { count: Number(rr.released_count || 0), amount: Number(rr.released_amount || 0) },
            notDuplicate: { count: Number(rr.not_duplicate_count || 0), amount: Number(rr.not_duplicate_amount || 0) },
            confirmedDuplicate: { count: Number(rr.confirmed_dup_count || 0), amount: Number(rr.confirmed_dup_amount || 0) },
        };

        // 9. Recent activity for live ticker (last 5 invoice actions)
        const recentResult: any = await db.execute(sql`
            SELECT 
                i.invoice_number, 
                i.amount,
                i.status,
                v.name as vendor_name,
                i.created_at
            FROM invoices i
            LEFT JOIN vendors v ON v.id = i.vendor_id
            WHERE i.status IN ('held', 'AUTO_FLAGGED', 'BLOCKED', 'RECOVERY_REQUIRED', 'CLEARED')
            ORDER BY i.created_at DESC
            LIMIT 5
        `);
        const recentActivity = (recentResult.rows || []).map((r: any) => ({
            invoiceNumber: r.invoice_number,
            amount: Number(r.amount),
            status: r.status,
            vendorName: r.vendor_name || 'Unknown',
            createdAt: r.created_at,
        }));

        // 10. Total value at risk
        const atRiskResult: any = await db.execute(sql`
            SELECT COALESCE(SUM(amount), 0) as total FROM invoices WHERE is_duplicate = true
        `);
        const totalAtRisk = Number(atRiskResult.rows?.[0]?.total || 0);

        return NextResponse.json({
            kpi: {
                prevented: totalPrevented,
                successRate,
                confidenceAvg,
                detectedRisks: totalDetectedCount,
                openTasks,
                totalProcessed,
                totalProcessedValue,
                totalAtRisk,
                totalRecovered,
                totalOpenRecovery
            },
            monthlyData,
            categoryData,
            resolvedSummary,
            recentActivity
        });

    } catch (error) {
        console.error('Failed to fetch reports:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
