import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function clearSeededData() {
    console.log("Clearing seeded financial_documents and invoices...");

    await db.execute(sql`
        TRUNCATE TABLE
            recovery_activities,
            recovery_items,
            case_activities,
            duplicate_results,
            payment_proposals,
            invoices,
            financial_documents
        CASCADE
    `);

    console.log("✓ financial_documents and invoices cleared.");
    console.log("Your uploaded data via Historical Data Load is preserved in the staging/committed tables.");
    console.log("You can now re-upload the FinDocs Excel through Historical Data Load to set the baseline.");
}

clearSeededData().catch(err => { console.error(err); process.exit(1); });
