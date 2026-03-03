import { NextResponse } from "next/server";

// Legacy seed route — disabled in production.
// Use scripts/reset-and-seed.ts via CLI instead.
export async function POST() {
    return NextResponse.json({ message: "Seed route disabled. Use CLI scripts instead." }, { status: 410 });
}
