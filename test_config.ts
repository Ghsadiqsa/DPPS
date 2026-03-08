import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './src/lib/schema';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql, { schema });
    try {
        const config = await db.select().from(schema.dppsConfig);
        console.log("Config rows:", config.length);
        console.log("Config data:", config);
    } catch (e: any) {
        console.error("Query Error:", e.message);
    }
}
run();
