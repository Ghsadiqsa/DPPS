import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

/**
 * Heatmap API — Returns risk scores for 48 time blocks (4-hour windows over 8 days).
 * Each block represents the normalized risk level based on actual invoice activity.
 * Auto-refreshes every 4 hours on the frontend.
 */
export async function GET() {
    try {
        // Get invoice activity grouped into 4-hour blocks over the last 8 days (48 blocks)
        const result: any = await db.execute(sql`
            WITH time_blocks AS (
                SELECT 
                    generate_series(0, 47) as block_idx
            ),
            block_data AS (
                SELECT 
                    FLOOR(EXTRACT(EPOCH FROM (NOW() - created_at)) / 14400)::int as block_idx,
                    COUNT(*) as total_count,
                    COUNT(*) FILTER (WHERE is_duplicate = true) as dup_count,
                    COALESCE(SUM(amount) FILTER (WHERE is_duplicate = true), 0) as dup_amount,
                    COALESCE(AVG(similarity_score) FILTER (WHERE similarity_score > 0), 0) as avg_score
                FROM invoices
                WHERE created_at > NOW() - INTERVAL '8 days'
                GROUP BY FLOOR(EXTRACT(EPOCH FROM (NOW() - created_at)) / 14400)::int
            )
            SELECT 
                tb.block_idx,
                COALESCE(bd.total_count, 0) as total_count,
                COALESCE(bd.dup_count, 0) as dup_count,
                COALESCE(bd.dup_amount, 0) as dup_amount,
                COALESCE(bd.avg_score, 0) as avg_score
            FROM time_blocks tb
            LEFT JOIN block_data bd ON bd.block_idx = tb.block_idx
            ORDER BY tb.block_idx ASC
        `);

        const rows = result.rows || result;

        // Normalize to 0-1 risk scores
        const maxDupCount = Math.max(...rows.map((r: any) => Number(r.dup_count)), 1);

        const blocks = rows.map((r: any) => {
            const dupCount = Number(r.dup_count);
            const totalCount = Number(r.total_count);
            const avgScore = Number(r.avg_score);

            // Risk is a composite of: duplicate ratio, count density, and avg similarity score
            let risk = 0;
            if (totalCount > 0) {
                const dupRatio = dupCount / Math.max(totalCount, 1);
                const densityFactor = dupCount / maxDupCount;
                const scoreFactor = avgScore / 100;
                risk = Math.min(1, (dupRatio * 0.3) + (densityFactor * 0.4) + (scoreFactor * 0.3));
            }

            return {
                blockIdx: Number(r.block_idx),
                risk: parseFloat(risk.toFixed(3)),
                totalCount,
                dupCount,
                dupAmount: Number(r.dup_amount),
                avgScore: parseFloat(avgScore.toFixed(1)),
            };
        });

        return NextResponse.json({
            blocks,
            generatedAt: new Date().toISOString(),
            refreshIntervalMs: 4 * 60 * 60 * 1000, // 4 hours in ms
        });

    } catch (error) {
        console.error('Failed to generate heatmap data:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
