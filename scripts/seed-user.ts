import { db } from '../src/lib/db';
import { users } from '../src/lib/schema';
import { sql } from 'drizzle-orm';
import "dotenv/config";
import * as dotenv from "dotenv";
import bcrypt from 'bcryptjs';

dotenv.config({ path: ".env.local" });

async function main() {
    console.log("Starting Admin User Seed...");

    // Create an Admin user
    const adminPassword = await bcrypt.hash('password123', 10);

    await db.insert(users).values({
        username: 'admin',
        password: adminPassword,
        email: 'admin@dpps.io',
        fullName: 'Jane Doe',
        role: 'ADMINISTRATOR',
        status: 'Active',
        authMethod: 'Email'
    }).onConflictDoNothing();

    console.log("Seeding complete. Use admin@dpps.io / password123 to log in.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
