import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users } from "@/lib/schema";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { eq } from "drizzle-orm";

export async function GET() {
    try {
        const allUsers = await db.select({
            id: users.id,
            username: users.username,
            email: users.email,
            fullName: users.fullName,
            role: users.role,
            status: users.status,
            authMethod: users.authMethod
        }).from(users);

        return NextResponse.json(allUsers);
    } catch (error) {
        return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user || (session.user as any).role !== 'ADMINISTRATOR') {
            return NextResponse.json({ error: "Unauthorized: Only administrators can create users." }, { status: 403 });
        }

        const { name, email, password, role } = await req.json();

        if (!email || !password || !name) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const [newUser] = await db.insert(users).values({
            username: name.toLowerCase().replace(/\s+/g, ''),
            email,
            fullName: name,
            password: hashedPassword,
            role: role || 'Viewer',
            status: 'Active',
            authMethod: 'Email'
        }).returning();

        return NextResponse.json({ success: true, user: newUser });
    } catch (error) {
        console.error("Error creating user:", error);
        return NextResponse.json({ error: "Failed to create user. Email may exist." }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const session = await auth();

        if (!session?.user || (session.user as any).role !== 'ADMINISTRATOR') {
            return NextResponse.json({ error: "Unauthorized: Only administrators can update users." }, { status: 403 });
        }

        const { userId, newRole } = await req.json();

        if (!userId || !newRole) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const [updatedUser] = await db.update(users)
            .set({ role: newRole })
            .where(eq(users.id, userId))
            .returning();

        return NextResponse.json({ success: true, user: updatedUser });
    } catch (error) {
        console.error("Error updating user:", error);
        return NextResponse.json({ error: "Failed to update user." }, { status: 500 });
    }
}
