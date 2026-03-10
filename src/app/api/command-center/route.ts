import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        // 1. Executive KPIs (Section 1)

        // Total Processed
        const processedResult: any = await db.execute(sql`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM invoices
        `);
        const totalProcessedValue = Number(processedResult.rows?.[0]?.total_value || 0);
        const totalProcessedCount = Number(processedResult.rows?.[0]?.count || 0);

        // Exposure At Risk (Open Potential Duplicates)
        const exposureResult: any = await db.execute(sql`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM invoices WHERE status IN ('UPLOADED', 'AUTO_FLAGGED', 'UNDER_INVESTIGATION')
        `);
        const exposureAtRiskValue = Number(exposureResult.rows?.[0]?.total_value || 0);
        const exposureAtRiskCount = Number(exposureResult.rows?.[0]?.count || 0);

        // Total Prevented (Pre-Payment Blocked)
        const preventedResult: any = await db.execute(sql`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM invoices WHERE status = 'BLOCKED'
        `);
        const totalPreventedValue = Number(preventedResult.rows?.[0]?.total_value || 0);
        const totalPreventedCount = Number(preventedResult.rows?.[0]?.count || 0);

        // Total Recovered (Post-Payment Recovered)
        const recoveredResult: any = await db.execute(sql`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM invoices WHERE status = 'RECOVERED'
        `);
        const totalRecoveredValue = Number(recoveredResult.rows?.[0]?.total_value || 0);
        const totalRecoveredCount = Number(recoveredResult.rows?.[0]?.count || 0);

        // Total Paid Duplicates (for Leakage calculation)
        const paidDupResult: any = await db.execute(sql`
            SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total_value FROM invoices WHERE status IN ('PAID_DUPLICATE', 'RECOVERY_REQUIRED', 'RECOVERED')
        `);
        const totalPaidDuplicates = Number(paidDupResult.rows?.[0]?.total_value || 0);

        const totalDetectedDups = totalPreventedValue + totalPaidDuplicates;
        const duplicateLeakageRate = totalDetectedDups > 0 ? parseFloat(((totalPaidDuplicates / totalDetectedDups) * 100).toFixed(1)) : 0;

        // System Performance Metrics (Auto Block, Confidence, FPR, Analyst Intervention)
        const perfResult: any = await db.execute(sql`
            SELECT 
                COUNT(*) as total_invoices,
                SUM(CASE WHEN is_duplicate = true THEN 1 ELSE 0 END) as total_dups,
                SUM(CASE WHEN is_duplicate = true AND status = 'BLOCKED' AND status_updated_by IS NULL THEN 1 ELSE 0 END) as auto_blocked,
                AVG(CASE WHEN is_duplicate = true THEN similarity_score ELSE NULL END) as avg_confidence,
                SUM(CASE WHEN similarity_score > 0 THEN 1 ELSE 0 END) as total_flagged,
                SUM(CASE WHEN similarity_score > 0 AND status = 'CLEARED' THEN 1 ELSE 0 END) as false_positives,
                SUM(CASE WHEN status_updated_by IS NOT NULL THEN 1 ELSE 0 END) as analyst_touched
            FROM invoices
        `);

        const perfRow = perfResult.rows[0];
        const total_invoices = Number(perfRow?.total_invoices || 0);
        const total_dups = Number(perfRow?.total_dups || 0);
        const total_flagged = Number(perfRow?.total_flagged || 0);

        const autoBlockRate = total_dups > 0 ? parseFloat(((Number(perfRow.auto_blocked) / total_dups) * 100).toFixed(1)) : 0;
        const confidence_avg = parseFloat(Number(perfRow?.avg_confidence || 0).toFixed(1));
        const false_positive_rate = total_flagged > 0 ? parseFloat(((Number(perfRow.false_positives) / total_flagged) * 100).toFixed(1)) : 0;
        const analyst_intervention = total_invoices > 0 ? parseFloat(((Number(perfRow.analyst_touched) / total_invoices) * 100).toFixed(1)) : 0;

        // Manual Override Rate from audit_log
        const overrideResult: any = await db.execute(sql`
            SELECT COUNT(DISTINCT invoice_id) as override_count FROM audit_log WHERE action = 'OVERRIDE'
        `);
        const manual_override_rate = total_invoices > 0 ? parseFloat(((Number(overrideResult.rows[0]?.override_count || 0) / total_invoices) * 100).toFixed(1)) : 0;

        const executiveKpis = {
            totalProcessedValue,
            totalProcessedCount,
            exposureAtRiskValue,
            exposureAtRiskCount,
            totalPreventedValue,
            totalPreventedCount,
            totalRecoveredValue,
            totalRecoveredCount,
            duplicateLeakageRate,
            autoBlockRate
        };

        // 2. Workflow Health Panel
        const workflowResult: any = await db.execute(sql`
            SELECT 
                status, 
                COUNT(*) as count, 
                COALESCE(SUM(amount), 0) as total_value,
                EXTRACT(EPOCH FROM AVG(NOW() - created_at))/86400 as avg_age_days
            FROM invoices 
            WHERE status != 'UPLOADED'
            GROUP BY status
        `);
        const workflowHealth = workflowResult.rows;

        // 3. Risk Classification Panel

        // A) Risk Band Distribution
        const riskBandsResult: any = await db.execute(sql`
            SELECT 
                CASE 
                    WHEN similarity_score >= 80 THEN 'High'
                    WHEN similarity_score >= 50 THEN 'Medium'
                    ELSE 'Low'
                END as band,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_value
            FROM invoices
            WHERE is_duplicate = true
            GROUP BY 
                CASE 
                    WHEN similarity_score >= 80 THEN 'High'
                    WHEN similarity_score >= 50 THEN 'Medium'
                    ELSE 'Low'
                END
        `);

        // B) Detection Type Breakdown
        // We parse signals arrays to aggregate detection types
        const signalsResult: any = await db.execute(sql`
            SELECT unnest(signals) as signal, amount 
            FROM invoices WHERE is_duplicate = true
        `);

        // We'll aggregate this strictly in the UI or process here.
        const detectionTypes = {
            'exact_match': 0,
            'fuzzy_invoice_pattern': 0,
            'vendor_match': 0,
            'po_match': 0,
            'date_proximity': 0
        };

        signalsResult.rows?.forEach((row: any) => {
            try {
                // Since signals is text array representing JSON strings...
                if (typeof row.signal === 'string') {
                    const sig = JSON.parse(row.signal);
                    const name = sig.name.toLowerCase();
                    const val = Number(row.amount);
                    if (name.includes('exact')) detectionTypes['exact_match'] += val;
                    else if (name.includes('vendor')) detectionTypes['vendor_match'] += val;
                    else if (name.includes('date')) detectionTypes['date_proximity'] += val;
                    else if (name.includes('fuzzy') || name.includes('pattern')) detectionTypes['fuzzy_invoice_pattern'] += val;
                    else detectionTypes['po_match'] += val;
                }
            } catch (e) { }
        });

        // 4. Financial Impact Trend
        const trendResult: any = await db.execute(sql`
            SELECT 
                TO_CHAR(created_at, 'Mon YYYY') as month,
                SUM(CASE WHEN status = 'BLOCKED' THEN amount ELSE 0 END) as prevented_value,
                SUM(CASE WHEN status IN ('PAID_DUPLICATE', 'RECOVERY_REQUIRED') THEN amount ELSE 0 END) as detected_post_payment,
                SUM(CASE WHEN status = 'RECOVERED' THEN amount ELSE 0 END) as recovered_value
            FROM invoices
            WHERE is_duplicate = true
            GROUP BY TO_CHAR(created_at, 'Mon YYYY'), DATE_TRUNC('month', created_at)
            ORDER BY DATE_TRUNC('month', created_at) ASC
            LIMIT 12
        `);

        // 5. Vendor Risk Intelligence
        const vendorIntelResult: any = await db.execute(sql`
            SELECT 
                v.name as vendor_name,
                COUNT(i.id) as duplicate_count,
                COALESCE(SUM(i.amount), 0) as total_value,
                MAX(i.similarity_score) as max_risk_score,
                MAX(i.created_at) as last_duplicate_date,
                SUM(CASE WHEN i.status = 'RECOVERED' THEN i.amount ELSE 0 END) as total_recovered
            FROM invoices i
            JOIN vendors v ON i.vendor_id = v.id
            WHERE i.is_duplicate = true
            GROUP BY v.name
            ORDER BY total_value DESC
            LIMIT 10
        `);

        // Calculate recovery rate per vendor
        const vendors = vendorIntelResult.rows.map((v: any) => ({
            ...v,
            recovery_success_rate: v.total_value > 0 ? (v.total_recovered / v.total_value) * 100 : 0,
            risk_band: v.max_risk_score >= 80 ? 'High' : v.max_risk_score >= 50 ? 'Medium' : 'Low'
        }));

        // 6. Governance
        const auditResult: any = await db.execute(sql`
            SELECT 
                COUNT(*) as total_decisions_today,
                SUM(CASE WHEN metadata->>'comment' IS NULL THEN 1 ELSE 0 END) as decisions_without_comment,
                SUM(CASE WHEN action = 'OVERRIDE' THEN 1 ELSE 0 END) as overrides,
                SUM(CASE WHEN action = 'ESCALATE' THEN 1 ELSE 0 END) as escalations
            FROM audit_log
            WHERE created_at >= CURRENT_DATE
        `);

        const invoiceStateResult: any = await db.execute(sql`
            SELECT 
                SUM(CASE WHEN locked = true THEN 1 ELSE 0 END) as locked_invoices,
                SUM(CASE WHEN erp_sync_status != 'SYNCED' THEN 1 ELSE 0 END) as pending_sync
            FROM invoices
        `);

        return NextResponse.json({
            executiveKpis,
            workflowHealth,
            riskClassification: {
                bands: riskBandsResult.rows,
                detectionTypes,
                modelMetrics: {
                    confidence_avg: confidence_avg,
                    false_positive_rate: false_positive_rate,
                    manual_override_rate: manual_override_rate,
                    analyst_intervention: analyst_intervention
                }
            },
            financialTrend: trendResult.rows,
            vendorIntelligence: vendors,
            governance: {
                ...auditResult.rows[0],
                ...invoiceStateResult.rows[0]
            }
        });
    } catch (error) {
        console.error('Error fetching command center data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch command center report data' },
            { status: 500 }
        );
    }
}
