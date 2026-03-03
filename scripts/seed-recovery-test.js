const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.DATABASE_URL
});

async function main() {
    console.log('Inserting test data for Recovery/Efficiency...');
    try {
        // Find an existing vendor or use a placeholder
        const vendorResult = await pool.query(`SELECT id FROM vendors LIMIT 1`);
        let vendorId = vendorResult.rows[0]?.id;

        if (!vendorId) {
            console.log("No vendor found. Create a fallback vendor.");
            return;
        }

        // Create 4 Recovery Required Invoices
        for (let i = 1; i <= 4; i++) {
            await pool.query(`
                INSERT INTO invoices (invoice_number, vendor_id, amount, invoice_date, status, is_duplicate)
                VALUES ($1, $2, $3, NOW(), 'RECOVERY_REQUIRED', true)
            `, [`INV-REC-TEST-${i}`, vendorId, i * 1000]);
            console.log(`Inserted RECOVERY_REQUIRED invoice $${i * 1000}`);
        }

        // Create 2 Recovered Invoices
        for (let i = 1; i <= 2; i++) {
            await pool.query(`
                INSERT INTO invoices (invoice_number, vendor_id, amount, invoice_date, status, is_duplicate)
                VALUES ($1, $2, $3, NOW(), 'RECOVERED', true)
            `, [`INV-REC-DONE-${i}`, vendorId, i * 1500]);
            console.log(`Inserted RECOVERED invoice $${i * 1500}`);
        }

        console.log('Finished inserting test data.');
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
