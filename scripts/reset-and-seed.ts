import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { vendors, invoices, cases, customers, financialDocuments, paymentProposals, uploadBatches, historicalStaging, duplicateResults, recoveryItems, recoveryActivities, caseActivities } from '../src/lib/schema';

async function resetAndSeed() {
    console.log("=== DPPS FULL DATABASE RESET ===");
    console.log("Truncating ALL operational tables (preserving users, role_permissions, api_tokens, dpps_config)...\n");

    // Truncate all operational tables in dependency order
    await db.execute(sql`
        TRUNCATE TABLE
            recovery_activities,
            recovery_items,
            case_activities,
            duplicate_results,
            payment_proposals,
            historical_staging,
            invoices,
            financial_documents,
            cases,
            upload_batches,
            customers,
            vendors
        CASCADE
    `);
    console.log("✓ All operational tables truncated.\n");

    // ===== SEED VENDORS =====
    console.log("Seeding vendors...");
    const vendorData = [
        { id: "V-1001", name: "Acme Industrial Supply", vendorCode: "ACME-IND", taxId: "TAX-8821901", iban: "DE89370400440532013000", swiftBic: "COBADEFFXXX", addressLine1: "100 Industrial Parkway", postalCode: "60614", country: "US", companyCode: "1000", phoneNumber: "+1-312-555-0100", email: "ap@acmeindustrial.com", paymentTerms: "Net 30", riskLevel: "low" },
        { id: "V-1002", name: "Global Office Supplies Ltd", vendorCode: "GLOS-001", taxId: "TAX-7734512", iban: "GB29NWBK60161331926819", swiftBic: "NWBKGB2L", addressLine1: "45 Commerce Street", postalCode: "EC2R 8AH", country: "GB", companyCode: "1000", phoneNumber: "+44-20-7946-0958", email: "invoices@globaloffice.co.uk", paymentTerms: "Net 45", riskLevel: "low" },
        { id: "V-1003", name: "TechVision Components GmbH", vendorCode: "TVCO-DE", taxId: "TAX-DE293847", iban: "DE27100777770209299700", swiftBic: "DEUTDEFF", addressLine1: "Berliner Str. 42", postalCode: "80331", country: "DE", companyCode: "2000", phoneNumber: "+49-89-123-4567", email: "billing@techvision.de", paymentTerms: "Net 60", riskLevel: "medium" },
        { id: "V-1004", name: "Pacific Freight & Logistics", vendorCode: "PACF-001", taxId: "TAX-9918273", iban: "US33000000002100037181", swiftBic: "CITIUS33", addressLine1: "800 Harbor Blvd", postalCode: "90731", country: "US", companyCode: "1000", phoneNumber: "+1-310-555-0200", email: "accounts@pacificfreight.com", paymentTerms: "Net 30", riskLevel: "low" },
        { id: "V-1005", name: "Meridian Consulting Services", vendorCode: "MERI-CON", taxId: "TAX-5567890", iban: "FR7630006000011234567890189", swiftBic: "BNPAFRPP", addressLine1: "12 Rue de la Paix", postalCode: "75002", country: "FR", companyCode: "3000", phoneNumber: "+33-1-42-68-5300", email: "finance@meridianconsulting.fr", paymentTerms: "Net 30", riskLevel: "high" },
        { id: "V-1006", name: "Summit Manufacturing Inc", vendorCode: "SUMM-MFG", taxId: "TAX-3345671", iban: "US64000000002200048292", swiftBic: "CHASUS33", addressLine1: "2500 Factory Lane", postalCode: "48201", country: "US", companyCode: "1000", phoneNumber: "+1-313-555-0300", email: "ar@summitmfg.com", paymentTerms: "Net 45", riskLevel: "low" },
        { id: "V-1007", name: "Nordic IT Solutions AB", vendorCode: "NORD-IT", taxId: "TAX-SE778899", iban: "SE4550000000058398257466", swiftBic: "ESSESESS", addressLine1: "Sveavägen 15", postalCode: "111 57", country: "SE", companyCode: "2000", phoneNumber: "+46-8-123-456", email: "payments@nordicit.se", paymentTerms: "Net 30", riskLevel: "low" },
        { id: "V-1008", name: "Atlas Building Materials", vendorCode: "ATLB-001", taxId: "TAX-1123456", iban: "US75000000003300059303", swiftBic: "BOFAUS3N", addressLine1: "1800 Construction Ave", postalCode: "30301", country: "US", companyCode: "1000", phoneNumber: "+1-404-555-0400", email: "invoices@atlasbuilding.com", paymentTerms: "Net 60", riskLevel: "medium" },
        { id: "V-1009", name: "Pinnacle Legal Partners LLP", vendorCode: "PINL-LLP", taxId: "TAX-6654321", iban: "GB82WEST12345698765432", swiftBic: "WESTGB2L", addressLine1: "One Canary Wharf", postalCode: "E14 5AB", country: "GB", companyCode: "3000", phoneNumber: "+44-20-7123-4567", email: "billing@pinnaclelegal.co.uk", paymentTerms: "Net 30", riskLevel: "high" },
        { id: "V-1010", name: "Green Energy Corp", vendorCode: "GREN-ENG", taxId: "TAX-4456789", iban: "NL91ABNA0417164300", swiftBic: "ABNANL2A", addressLine1: "Herengracht 100", postalCode: "1015 BS", country: "NL", companyCode: "2000", phoneNumber: "+31-20-555-0500", email: "finance@greenenergy.nl", paymentTerms: "Net 45", riskLevel: "low" },
    ];

    for (const v of vendorData) {
        await db.insert(vendors).values({
            id: v.id, name: v.name, vendorCode: v.vendorCode, taxId: v.taxId, iban: v.iban, swiftBic: v.swiftBic,
            addressLine1: v.addressLine1, postalCode: v.postalCode, country: v.country, companyCode: v.companyCode,
            phoneNumber: v.phoneNumber, email: v.email, paymentTerms: v.paymentTerms, riskLevel: v.riskLevel,
            totalSpend: "0", duplicateCount: 0
        });
    }
    console.log(`✓ ${vendorData.length} vendors created.\n`);

    // ===== SEED CUSTOMERS =====
    console.log("Seeding customers...");
    const customerData = [
        { customerNumber: "C-2001", name: "Horizon Enterprises", taxId: "CTAX-1001", billingAddress: "500 Sunset Blvd, Los Angeles, CA", email: "ap@horizon.com", phone: "+1-213-555-0100", companyCode: "1000" },
        { customerNumber: "C-2002", name: "Sterling Corp", taxId: "CTAX-1002", billingAddress: "200 Wall Street, New York, NY", email: "billing@sterling.com", phone: "+1-212-555-0200", companyCode: "1000" },
        { customerNumber: "C-2003", name: "Apex Dynamics Ltd", taxId: "CTAX-1003", billingAddress: "10 Downing Ct, London, UK", email: "finance@apexdynamics.co.uk", phone: "+44-20-7946-1234", companyCode: "2000" },
        { customerNumber: "C-2004", name: "Quantum Solutions AG", taxId: "CTAX-1004", billingAddress: "Bahnhofstrasse 50, Zurich, CH", email: "accounts@quantumsolutions.ch", phone: "+41-44-123-4567", companyCode: "3000" },
        { customerNumber: "C-2005", name: "Redline Motors Inc", taxId: "CTAX-1005", billingAddress: "1200 Motor City Dr, Detroit, MI", email: "ar@redlinemotors.com", phone: "+1-313-555-0500", companyCode: "1000" },
    ];

    for (const c of customerData) {
        await db.insert(customers).values(c);
    }
    console.log(`✓ ${customerData.length} customers created.\n`);

    // ===== SEED FINANCIAL DOCUMENTS (Historical Baseline) =====
    console.log("Seeding financial documents (historical baseline)...");
    const finDocs = [
        // Vendor invoices for the last 90 days — these become the historical baseline against which Payment Gate will detect duplicates
        { documentNumber: "DOC-5001", invoiceNumber: "INV-2024-001", vendorId: "V-1001", invoiceDate: daysAgo(85), postingDate: daysAgo(84), amount: "12500.00", currency: "USD", companyCode: "1000", referenceNumber: "PO-8001" },
        { documentNumber: "DOC-5002", invoiceNumber: "INV-2024-002", vendorId: "V-1001", invoiceDate: daysAgo(72), postingDate: daysAgo(71), amount: "8750.50", currency: "USD", companyCode: "1000", referenceNumber: "PO-8002" },
        { documentNumber: "DOC-5003", invoiceNumber: "INV-2024-003", vendorId: "V-1002", invoiceDate: daysAgo(68), postingDate: daysAgo(67), amount: "3200.00", currency: "GBP", companyCode: "1000", referenceNumber: "PO-8003" },
        { documentNumber: "DOC-5004", invoiceNumber: "INV-2024-004", vendorId: "V-1003", invoiceDate: daysAgo(60), postingDate: daysAgo(59), amount: "45000.00", currency: "EUR", companyCode: "2000", referenceNumber: "PO-8004" },
        { documentNumber: "DOC-5005", invoiceNumber: "INV-2024-005", vendorId: "V-1004", invoiceDate: daysAgo(55), postingDate: daysAgo(54), amount: "9800.00", currency: "USD", companyCode: "1000", referenceNumber: "PO-8005" },
        { documentNumber: "DOC-5006", invoiceNumber: "INV-2024-006", vendorId: "V-1005", invoiceDate: daysAgo(50), postingDate: daysAgo(49), amount: "22000.00", currency: "EUR", companyCode: "3000", referenceNumber: "PO-8006" },
        { documentNumber: "DOC-5007", invoiceNumber: "INV-2024-007", vendorId: "V-1006", invoiceDate: daysAgo(45), postingDate: daysAgo(44), amount: "15750.75", currency: "USD", companyCode: "1000", referenceNumber: "PO-8007" },
        { documentNumber: "DOC-5008", invoiceNumber: "INV-2024-008", vendorId: "V-1007", invoiceDate: daysAgo(40), postingDate: daysAgo(39), amount: "6300.00", currency: "SEK", companyCode: "2000", referenceNumber: "PO-8008" },
        { documentNumber: "DOC-5009", invoiceNumber: "INV-2024-009", vendorId: "V-1008", invoiceDate: daysAgo(35), postingDate: daysAgo(34), amount: "31200.00", currency: "USD", companyCode: "1000", referenceNumber: "PO-8009" },
        { documentNumber: "DOC-5010", invoiceNumber: "INV-2024-010", vendorId: "V-1009", invoiceDate: daysAgo(30), postingDate: daysAgo(29), amount: "18500.00", currency: "GBP", companyCode: "3000", referenceNumber: "PO-8010" },
        { documentNumber: "DOC-5011", invoiceNumber: "INV-2024-011", vendorId: "V-1010", invoiceDate: daysAgo(25), postingDate: daysAgo(24), amount: "7890.00", currency: "EUR", companyCode: "2000", referenceNumber: "PO-8011" },
        { documentNumber: "DOC-5012", invoiceNumber: "INV-2024-012", vendorId: "V-1001", invoiceDate: daysAgo(20), postingDate: daysAgo(19), amount: "5500.00", currency: "USD", companyCode: "1000", referenceNumber: "PO-8012" },
        { documentNumber: "DOC-5013", invoiceNumber: "INV-2024-013", vendorId: "V-1003", invoiceDate: daysAgo(15), postingDate: daysAgo(14), amount: "28000.00", currency: "EUR", companyCode: "2000", referenceNumber: "PO-8013" },
        { documentNumber: "DOC-5014", invoiceNumber: "INV-2024-014", vendorId: "V-1005", invoiceDate: daysAgo(10), postingDate: daysAgo(9), amount: "41000.00", currency: "EUR", companyCode: "3000", referenceNumber: "PO-8014" },
        { documentNumber: "DOC-5015", invoiceNumber: "INV-2024-015", vendorId: "V-1006", invoiceDate: daysAgo(5), postingDate: daysAgo(4), amount: "11250.00", currency: "USD", companyCode: "1000", referenceNumber: "PO-8015" },
    ];

    for (const doc of finDocs) {
        await db.insert(financialDocuments).values(doc);
    }
    console.log(`✓ ${finDocs.length} financial documents created.\n`);

    // ===== SEED INVOICES (for Dashboard charts) =====
    console.log("Seeding invoices for dashboard...");
    const vendorIds = vendorData.map(v => v.id);
    const statuses = ['UPLOADED', 'UPLOADED', 'UPLOADED', 'AUTO_FLAGGED', 'UNDER_INVESTIGATION', 'BLOCKED', 'CLEARED'];
    let invCount = 0;

    for (let i = 0; i < 50; i++) {
        const vid = vendorIds[i % vendorIds.length];
        const amount = (500 + Math.random() * 30000).toFixed(2);
        const days = Math.floor(Math.random() * 30);
        const date = new Date();
        date.setDate(date.getDate() - days);
        const statusPick = statuses[i % statuses.length];
        const isDup = statusPick === 'AUTO_FLAGGED' || statusPick === 'BLOCKED';

        await db.insert(invoices).values({
            invoiceNumber: `INV-SEED-${10000 + i}`,
            vendorId: vid,
            amount,
            invoiceDate: date,
            status: statusPick,
            isDuplicate: isDup,
            similarityScore: isDup ? Math.floor(50 + Math.random() * 50) : 0,
            signals: isDup ? ['Exact Amount', 'Vendor Match'] : [],
        });
        invCount++;
    }
    console.log(`✓ ${invCount} invoices created.\n`);

    console.log("=== RESET & SEED COMPLETE ===");
    console.log("You can now:");
    console.log("  1. Download test Excel files from /test-data/");
    console.log("  2. Use Historical Data Load to import them");
    console.log("  3. Use Payment Gate to upload the payment proposal CSV");
}

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

resetAndSeed().catch(err => {
    console.error("Reset failed:", err);
    process.exit(1);
});
