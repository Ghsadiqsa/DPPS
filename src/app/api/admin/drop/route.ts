import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
// We will import schema once push succeeds, for now just raw SQL to drop
export async function POST(request: NextRequest) {
    try {
        console.log("Dropping all tables...");
        // Drop schema to reset everything
        await db.execute(sql`DROP SCHEMA public CASCADE;`);
        await db.execute(sql`CREATE SCHEMA public;`);
        await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);

        return NextResponse.json({ success: true, message: "Database wiped." });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
