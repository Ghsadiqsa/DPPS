import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vendors, invoices } from '@/lib/schema';
import { desc, sql, eq } from 'drizzle-orm';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const ranking = searchParams.get('ranking'); // 'risk' for top risk vendors

        if (ranking === 'risk') {
            // Top 10 vendors by actual duplicate invoice count and total flagged amount
            const result: any = await db.execute(sql`
                SELECT 
                    v.id,
                    v.name,
                    v.vendor_code,
                    v.risk_level,
                    v.country,
                    v.company_code,
                    COUNT(i.id) as duplicate_count,
                    COALESCE(SUM(i.amount), 0) as total_flagged_amount
                FROM vendors v
                LEFT JOIN invoices i ON i.vendor_id = v.id AND i.is_duplicate = true
                GROUP BY v.id, v.name, v.vendor_code, v.risk_level, v.country, v.company_code
                HAVING COUNT(i.id) > 0
                ORDER BY COUNT(i.id) DESC, SUM(i.amount) DESC
                LIMIT 10
            `);

            const rows = result.rows || result;
            return NextResponse.json(rows.map((r: any) => ({
                id: r.id,
                name: r.name,
                vendorCode: r.vendor_code,
                riskLevel: r.risk_level,
                country: r.country,
                companyCode: r.company_code,
                duplicateCount: Number(r.duplicate_count),
                totalFlaggedAmount: Number(r.total_flagged_amount),
            })));
        }

        // Default: return all vendors ordered by totalSpend
        const allVendors = await db.select().from(vendors).orderBy(desc(vendors.totalSpend));
        return NextResponse.json(allVendors);
    } catch (error) {
        console.error('Failed to fetch vendors:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
