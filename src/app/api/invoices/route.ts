import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql, and, eq, gte, lte, ilike, or, inArray } from "drizzle-orm";
import { invoices, vendors, dppsConfig } from "@/lib/schema";
import { convertCurrency } from "@/lib/currency";

export async function GET(request: NextRequest) {
    try {
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
            console.warn("API Invoices: Database column mismatch - defaulting to USD.");
        }

        const { searchParams } = new URL(request.url);

        // Filters
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");
        const erpType = searchParams.get("erpType");
        const companyCode = searchParams.get("companyCode");
        const vendorCode = searchParams.get("vendorCode");
        const currency = searchParams.get("currency");
        const riskBand = searchParams.get("riskBand");
        const search = searchParams.get("search");

        // Support array of statuses 
        const lifecycleStates = searchParams.getAll("lifecycleState");
        const statuses = searchParams.getAll("status");
        const combinedStates = [...new Set([...lifecycleStates, ...statuses])];

        // Pagination
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const offset = (page - 1) * limit;

        // Building dynamic filter for Drizzle
        const filters = [];
        if (erpType) filters.push(eq(invoices.erpType, erpType));
        if (companyCode) filters.push(eq(invoices.companyCode, companyCode));
        if (vendorCode) filters.push(eq(invoices.vendorCode, vendorCode));
        if (currency) filters.push(eq(invoices.currency, currency));
        if (riskBand) filters.push(eq(invoices.riskBand, riskBand));

        if (combinedStates.length > 0) {
            filters.push(inArray(invoices.lifecycleState, combinedStates));
        }

        if (startDate) filters.push(gte(invoices.createdAt, new Date(startDate)));
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            filters.push(lte(invoices.createdAt, end));
        }

        if (search) {
            filters.push(or(
                ilike(invoices.invoiceNumber, `%${search}%`),
                ilike(invoices.vendorCode, `%${search}%`),
                ilike(invoices.poNumber, `%${search}%`)
            ));
        }

        const whereClause = filters.length > 0 ? and(...filters) : undefined;

        // 1. Fetch Invoices with Vendor Join
        const results = await db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            invoiceDate: invoices.invoiceDate,
            grossAmount: invoices.grossAmount,
            currency: invoices.currency,
            vendorCode: invoices.vendorCode,
            vendorName: vendors.name,
            lifecycleState: invoices.lifecycleState,
            riskScore: invoices.riskScore,
            riskBand: invoices.riskBand,
            poNumber: invoices.poNumber,
            erpType: invoices.erpType,
            companyCode: invoices.companyCode,
            paymentStatus: invoices.paymentStatus,
            duplicateGroupId: invoices.duplicateGroupId,
            matchSource: invoices.matchSource,
            matchingReason: invoices.matchingReason,
            systemComments: invoices.systemComments,
            updatedAt: invoices.updatedAt

        })
            .from(invoices)
            .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
            .where(whereClause)
            .limit(limit)
            .offset(offset)
            .orderBy(sql`${invoices.createdAt} DESC`);

        // 2. Fetch Total Count for Pagination
        const countResult = await db.select({ count: sql`COUNT(*)` })
            .from(invoices)
            .where(whereClause);

        const totalCount = Number(countResult[0]?.count || 0);

        return NextResponse.json({
            data: results.map(item => ({
                ...item,
                amountInReportingCurrency: convertCurrency(Number(item.grossAmount), item.currency || 'USD', reportingCurrency)
            })),
            pagination: {
                totalCount,
                totalPages: Math.ceil(totalCount / limit),
                currentPage: page,
                limit
            },
            metadata: {
                reportingCurrency,
                showSideBySideAmounts: showSideBySide
            }
        });

    } catch (error) {
        console.error("Invoices API Error:", error);
        return NextResponse.json({ error: "Failed to fetch invoices." }, { status: 500 });
    }
}
