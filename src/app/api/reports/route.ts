import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invoices, recoveryItems } from '@/lib/schema';
import { sql } from 'drizzle-orm';

export async function GET() {
    try {
        // 1. Calculate KPIs
        // Total Prevented: Sum of amounts of 'held' invoices. 
        // Note: details depend on specific driver response shape. 
        // For safest Drizzle usage, we can use query builder for simple aggs or cast the result.
        const preventedResult: any = await db.execute(sql`
      SELECT SUM(amount) as total FROM invoices WHERE status = 'held' OR is_duplicate = true
    `);
        const totalPrevented = Number(preventedResult.rows?.[0]?.total || preventedResult[0]?.total || 0);

        // Total Detected
        const detectedResult: any = await db.execute(sql`
      SELECT COUNT(*) as count FROM invoices WHERE is_duplicate = true
    `);
        const totalDetectedCount = Number(detectedResult.rows?.[0]?.count || detectedResult[0]?.count || 0);

        // Success Rate (Mock calculation)
        const successRate = 98.2;

        // 2. Daily Data
        const dailyResult: any = await db.execute(sql`
        SELECT 
            TO_CHAR(created_at, 'Dy') as name,
            SUM(CASE WHEN status = 'held' THEN amount ELSE 0 END) as prevented,
            SUM(CASE WHEN is_duplicate = true THEN amount ELSE 0 END) as detected
        FROM invoices
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY TO_CHAR(created_at, 'Dy'), EXTRACT(DOW FROM created_at)
        ORDER BY EXTRACT(DOW FROM created_at)
    `);

        const dailyRows = dailyResult.rows || dailyResult;
        const monthlyData = dailyRows.length > 0 ? dailyRows : [
            { name: 'Mon', prevented: 0, detected: 0 }
        ];

        // 3. Category Data (Dynamic from signals array)
        const categoryResult: any = await db.execute(sql`
        SELECT 
            UNNEST(signals) as name,
            COUNT(*) as value
        FROM invoices
        WHERE is_duplicate = true AND array_length(signals, 1) > 0
        GROUP BY UNNEST(signals)
        `);

        let categoryData = categoryResult.rows || categoryResult;
        if (categoryData.length === 0) {
            categoryData = [
                { name: "Exact Match", value: 45, color: "#3498db" },
                { name: "Fuzzy Match", value: 30, color: "#f39c12" },
                { name: "OCR Error", value: 15, color: "#e74c3c" },
                { name: "Pattern Match", value: 10, color: "#9b59b6" },
            ];
        } else {
            const colors = ["#3498db", "#f39c12", "#e74c3c", "#9b59b6", "#2ecc71"];
            categoryData = categoryData.map((c: any, i: number) => ({
                name: c.name,
                value: Number(c.value),
                color: colors[i % colors.length]
            }));
        }

        return NextResponse.json({
            kpi: {
                prevented: totalPrevented,
                successRate,
                confidenceAvg: 94.5, // Placeholder
                detectedRisks: totalDetectedCount
            },
            monthlyData,
            categoryData
        });

    } catch (error) {
        console.error('Failed to fetch reports:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
