import { NextResponse } from "next/server";

// Legacy synthetic seed route — disabled. Use CLI scripts instead.
export async function POST() {
    return NextResponse.json({ message: "Seed route disabled. Use CLI scripts instead." }, { status: 410 });
}
