import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const type = searchParams.get('type');
        const limitStr = searchParams.get('limit');
        const limit = limitStr ? parseInt(limitStr, 10) : 100;

        if (type === 'vendors') {
            const data = await storage.getRecentVendors(limit);
            return NextResponse.json(data);
        } else if (type === 'customers') {
            const data = await storage.getRecentCustomers(limit);
            return NextResponse.json(data);
        } else if (type === 'financial-documents') {
            const data = await storage.getRecentFinancialDocuments(limit);
            return NextResponse.json(data);
        } else {
            return NextResponse.json({ error: "Invalid type parameter. Expected: vendors, customers, or financial-documents" }, { status: 400 });
        }
    } catch (error) {
        console.error("Error fetching preview data:", error);
        return NextResponse.json({ error: "Failed to fetch preview data" }, { status: 500 });
    }
}
