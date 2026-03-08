import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = dotenv.parse(fs.readFileSync(envPath));
for (const k in envConfig) {
    process.env[k] = envConfig[k];
}

async function drop() {
    const sql = neon(process.env.DATABASE_URL);
    console.log("Dropping public schema...");
    try {
        await sql`DROP SCHEMA public CASCADE`;
        await sql`CREATE SCHEMA public`;
        await sql`GRANT ALL ON SCHEMA public TO public`;
        console.log("Database tables dropped successfully. Ready for Drizzle push.");
    } catch (e) {
        console.error("Failed to drop schema:", e);
    }
}

drop();
