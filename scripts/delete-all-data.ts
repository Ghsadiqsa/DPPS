import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

/**
 * 🛰️ DPPS Enterprise - Full Operational Data Wipe
 * This script clears ALL transactional and operational data while preserving:
 * - Users & Auth
 * - Role Permissions
 * - API Tokens
 * - System Configuration (dpps_config)
 */
async function deleteAllData() {
    console.log("🚀 Starting Full Database Reset...");

    try {
        await db.execute(sql`
            TRUNCATE TABLE
                workflow_events,
                audit_log,
                recovery_activities,
                recovery_items,
                enterprise_recovery_cases,
                case_activities,
                duplicate_results,
                payment_proposals,
                historical_staging,
                duplicate_groups,
                invoices,
                financial_documents,
                cases,
                upload_batches,
                customers,
                vendors,
                report_templates
            CASCADE
        `);

        console.log("✅ SUCCESS: All operational data has been deleted.");
        console.log("🛡️ Preserved: users, role_permissions, api_tokens, dpps_config.");
        console.log("--------------------------------------------------");
        console.log("Your Control Tower is now a clean slate.");
    } catch (error) {
        console.error("❌ CRITICAL FAILURE during database reset:");
        console.error(error);
        process.exit(1);
    }
}

deleteAllData().catch(err => {
    console.error(err);
    process.exit(1);
});
