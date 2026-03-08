import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from '../src/lib/schema';
import { sql } from 'drizzle-orm';
import 'dotenv/config';

// Load .env.local for local development if present
import { config } from 'dotenv';
config({ path: '.env.local' });

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required to run the cleanup script');
}

const sql_neon = neon(process.env.DATABASE_URL);
const db = drizzle(sql_neon, { schema });

async function clearDatabase() {
    console.log('⚠️  Starting database cleanup...');
    try {
        // Disable foreign key checks for the duration of the cleanup
        // Neon uses Postgres, so we can't just globally disable standard FK checks easily in a transaction without superuser
        // Instead, we truncate all tables with CASCADE, or delete in reverse dependency order.
        // TRUNCATE CASCADE is cleaner and faster.

        console.log('Executing TRUNCATE CASCADE on all tables...');

        const tables = [
            'audit_log',
            'case_activities',
            'duplicate_groups',
            'duplicate_results',
            'enterprise_recovery_cases',
            'financial_documents',
            'historical_staging',
            'invoices',
            'cases',
            'payment_proposals',
            'recovery_activities',
            'recovery_items',
            'upload_batches',
            'customers',
            'vendors',
            'users',
            'role_permissions',
            'api_tokens',
            'dpps_config',
            'workflow_events'
        ];

        for (const table of tables) {
            console.log(`Truncating ${table}...`);
            await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE;`));
        }

        console.log('✅ Database cleanup completed successfully. All tables are empty.');

    } catch (error) {
        console.error('❌ Error during database cleanup:', error);
        process.exit(1);
    }
}

clearDatabase()
    .then(() => process.exit(0))
    .catch((e) => {
        console.error(e);
        process.exit(1);
    });
