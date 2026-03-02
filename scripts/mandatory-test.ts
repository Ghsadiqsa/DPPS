import { db } from '../src/lib/db';
import { vendors, financialDocuments, paymentProposals } from '../src/lib/schema';
import { eq } from 'drizzle-orm';

async function runTest() {
    console.log("=== Starting Mandatory Automated Test ===");

    // 1. Setup 5 Baseline Historical Records
    // Create a vendor to map to
    const [vendor] = await db.insert(vendors).values({
        name: "Acme Corp Ltd",
        taxId: "TAX-123",
        iban: "IBAN-555",
        companyCode: "CC-100",
    }).returning();

    const baselineDocs = [
        { documentNumber: "DOC-001", invoiceNumber: "INV-EXACT-1", vendorId: vendor.id, amount: "1000.00", invoiceDate: new Date("2024-01-01"), companyCode: "CC-100" },
        { documentNumber: "DOC-002", invoiceNumber: "INV-EXACT-2", vendorId: vendor.id, amount: "2000.00", invoiceDate: new Date("2024-01-02"), companyCode: "CC-100" },
        { documentNumber: "DOC-003", invoiceNumber: "INV-EXACT-3", vendorId: vendor.id, amount: "3000.00", invoiceDate: new Date("2024-01-03"), companyCode: "CC-100" },
        { documentNumber: "DOC-004", invoiceNumber: "INV-PARTIAL-1", vendorId: vendor.id, amount: "4000.00", invoiceDate: new Date("2024-01-04"), companyCode: "CC-100" },
        { documentNumber: "DOC-005", invoiceNumber: "INV-PARTIAL-2", vendorId: vendor.id, amount: "5000.00", invoiceDate: new Date("2024-01-05"), companyCode: "CC-100" },
    ];

    await db.insert(financialDocuments).values(baselineDocs);
    console.log("=> Inserted 5 known historical records.");

    // 2. Prepare 10 proposals
    const proposals = [
        // 3 Exact Duplicates (Perfect Match)
        { invoiceNumber: "INV-EXACT-1", vendorId: vendor.id, amount: "1000.00", invoiceDate: "2024-01-01", companyCode: "CC-100" },
        { invoiceNumber: "INV-EXACT-2", vendorId: vendor.id, amount: "2000.00", invoiceDate: "2024-01-02", companyCode: "CC-100" },
        { invoiceNumber: "INV-EXACT-3", vendorId: vendor.id, amount: "3000.00", invoiceDate: "2024-01-03", companyCode: "CC-100" },

        // 2 Partial Duplicates (FLAGGED - similar invoice pattern, exact amount or exact vendor)
        { invoiceNumber: "INV-PARTIAL-1-X", vendorId: vendor.id, amount: "4005.00", invoiceDate: "2024-01-04", companyCode: "CC-100" }, // Typos in Invoice & off by amount 
        { invoiceNumber: "INV-PARTIAL-2", vendorId: vendor.id, amount: "5001.00", invoiceDate: "2024-01-05", companyCode: "CC-100" }, // Slightly off amount

        // 5 Clean Records (No match)
        { invoiceNumber: "ALPHA-100", vendorId: "V-101", amount: "111.00", invoiceDate: "2024-02-01", companyCode: "CC-200" },
        { invoiceNumber: "BETA-200", vendorId: "V-202", amount: "222.00", invoiceDate: "2024-02-02", companyCode: "CC-200" },
        { invoiceNumber: "GAMMA-300", vendorId: "V-303", amount: "333.00", invoiceDate: "2024-02-03", companyCode: "CC-200" },
        { invoiceNumber: "DELTA-400", vendorId: "V-404", amount: "444.00", invoiceDate: "2024-02-04", companyCode: "CC-200" },
        { invoiceNumber: "EPSILON-500", vendorId: "V-505", amount: "555.00", invoiceDate: "2024-02-05", companyCode: "CC-200" },
    ];

    console.log("=> Sending 10 proposals to Payment Gate Validation endpoint...");

    const response = await fetch('http://localhost:3000/api/payment-gate/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            invoices: proposals,
            config: {}
        })
    });

    const data = await response.json() as any;

    // Verify constraints
    const duplicates = data.heldLines; // From summary: heldLines -> DUPLICATE
    const flagged = data.reviewLines; // From summary: reviewLines -> FLAGGED
    const clean = data.approvedLines; // From summary: approvedLines -> CLEAN

    console.log(`\n=== RESULTS ===`);
    console.log(`DUPLICATE EXPECTED: 3 | ACTUAL: ${duplicates}`);
    console.log(`FLAGGED EXPECTED: 2   | ACTUAL: ${flagged}`);
    console.log(`CLEAN EXPECTED: 5     | ACTUAL: ${clean}`);
    console.log(`DUPLICATE EXPECTED: 3 | ACTUAL: ${duplicates}`);
    console.log(`FLAGGED EXPECTED: 2   | ACTUAL: ${flagged}`);
    console.log(`CLEAN EXPECTED: 5     | ACTUAL: ${clean}`);

    if (duplicates === 3 && flagged === 2 && clean === 5) {
        console.log("\n✅ ALL TESTS PASSED. The logic meets the absolute user requirement.");
        require('fs').writeFileSync('test-results.json', JSON.stringify({ status: 'SUCCESS', ...data }, null, 2));
    } else {
        console.log("\n❌ TESTS FAILED.");
        require('fs').writeFileSync('test-results.json', JSON.stringify({ status: 'FAILED', ...data }, null, 2));
        if (data.duplicates) {
            data.duplicates.forEach((d: any) => console.log(d.invoiceNumber, d.status, d.score));
        }
    }

    process.exit(0);
}

runTest().catch(console.error);
