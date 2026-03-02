import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { rolePermissions } from "@/lib/schema";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

export async function GET() {
    try {
        const permissions = await db.select().from(rolePermissions);
        return NextResponse.json(permissions);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch permissions" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user || (session.user as any).role !== 'ADMINISTRATOR') {
            return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
        }

        const { role, allowedTabs } = await req.json();

        if (!role || !Array.isArray(allowedTabs)) {
            return NextResponse.json({ error: "Invalid data" }, { status: 400 });
        }

        // Upsert logic for permissions
        const existing = await db.select().from(rolePermissions).where(eq(rolePermissions.role, role)).limit(1);

        if (existing.length > 0) {
            const [updated] = await db.update(rolePermissions)
                .set({ allowedTabs, updatedAt: new Date() })
                .where(eq(rolePermissions.role, role))
                .returning();
            return NextResponse.json({ success: true, permission: updated });
        } else {
            const [inserted] = await db.insert(rolePermissions)
                .values({ role, allowedTabs })
                .returning();
            return NextResponse.json({ success: true, permission: inserted });
        }
    } catch (error) {
        console.error("Error setting permissions:", error);
        return NextResponse.json({ error: "Failed to update permissions." }, { status: 500 });
    }
}
