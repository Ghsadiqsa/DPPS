import { config } from "dotenv";
config({ path: ".env.local" });

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle({ client: sql });

async function main() {
    console.log("Fixing existing vendors null constraints...");

    // Vendors: populate nulls
    await sql`UPDATE vendors SET company_code = '1000' WHERE company_code IS NULL;`;
    await sql`UPDATE vendors SET vendor_code = 'VEND-LEGACY-' || id WHERE vendor_code IS NULL;`;

    console.log("Fixing invoices null constraints just in case...");
    await sql`UPDATE invoices SET vendor_code = 'VEND-LEGACY-' || vendor_id WHERE vendor_code IS NULL;`;
    await sql`UPDATE invoices SET amount = 0 WHERE amount IS NULL;`;

    console.log("Data cleansed for NOT NULL constraints.");
}

main().catch(console.error);
