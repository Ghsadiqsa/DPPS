
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });

async function check() {
    await client.connect();
    const res = await client.query(`
        SELECT id, lifecycle_state, is_duplicate_candidate, invoice_number 
        FROM invoices 
        WHERE lifecycle_state IN ('FLAGGED_HIGH', 'FLAGGED_MEDIUM', 'FLAGGED_LOW', 'IN_INVESTIGATION') 
           OR (is_duplicate_candidate = true AND lifecycle_state NOT IN ('CONFIRMED_DUPLICATE', 'RECOVERY_OPENED', 'RECOVERY_RESOLVED', 'NOT_DUPLICATE', 'CLEARED'))
    `);
    console.log(JSON.stringify(res.rows, null, 2));
    await client.end();
}

check().catch(console.error);
