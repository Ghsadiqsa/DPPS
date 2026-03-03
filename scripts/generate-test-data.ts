/**
 * Generate Excel test data files for DPPS testing.
 * Creates:
 *   1. SAP_Vendors.xlsx - Historical vendor load (SAP format)
 *   2. SAP_Customers.xlsx - Historical customer load (SAP format)
 *   3. SAP_Financial_Documents.xlsx - Historical financial docs (SAP format)
 *   4. Payment_Proposal_Test.csv - Payment Gate test file with intentional duplicates
 *
 * Run: npx tsx scripts/generate-test-data.ts
 * Files are saved to: public/test-data/
 */

import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.resolve(__dirname, '../public/test-data');

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
}

// ============================================
// 1. SAP VENDORS
// ============================================
function generateVendors() {
    const rows = [
        { LIFNR: "V-1001", NAME1: "Acme Industrial Supply", BUKRS: "1000", STCD1: "TAX-8821901", IBAN: "DE89370400440532013000", SWIFT: "COBADEFFXXX", STRAS: "100 Industrial Parkway", PSTLZ: "60614", LAND1: "US", TELF1: "+1-312-555-0100", SMTP_ADDR: "ap@acmeindustrial.com" },
        { LIFNR: "V-1002", NAME1: "Global Office Supplies Ltd", BUKRS: "1000", STCD1: "TAX-7734512", IBAN: "GB29NWBK60161331926819", SWIFT: "NWBKGB2L", STRAS: "45 Commerce Street", PSTLZ: "EC2R 8AH", LAND1: "GB", TELF1: "+44-20-7946-0958", SMTP_ADDR: "invoices@globaloffice.co.uk" },
        { LIFNR: "V-1003", NAME1: "TechVision Components GmbH", BUKRS: "2000", STCD1: "TAX-DE293847", IBAN: "DE27100777770209299700", SWIFT: "DEUTDEFF", STRAS: "Berliner Str. 42", PSTLZ: "80331", LAND1: "DE", TELF1: "+49-89-123-4567", SMTP_ADDR: "billing@techvision.de" },
        { LIFNR: "V-1004", NAME1: "Pacific Freight & Logistics", BUKRS: "1000", STCD1: "TAX-9918273", IBAN: "US33000000002100037181", SWIFT: "CITIUS33", STRAS: "800 Harbor Blvd", PSTLZ: "90731", LAND1: "US", TELF1: "+1-310-555-0200", SMTP_ADDR: "accounts@pacificfreight.com" },
        { LIFNR: "V-1005", NAME1: "Meridian Consulting Services", BUKRS: "3000", STCD1: "TAX-5567890", IBAN: "FR7630006000011234567890189", SWIFT: "BNPAFRPP", STRAS: "12 Rue de la Paix", PSTLZ: "75002", LAND1: "FR", TELF1: "+33-1-42-68-5300", SMTP_ADDR: "finance@meridianconsulting.fr" },
        { LIFNR: "V-1006", NAME1: "Summit Manufacturing Inc", BUKRS: "1000", STCD1: "TAX-3345671", IBAN: "US64000000002200048292", SWIFT: "CHASUS33", STRAS: "2500 Factory Lane", PSTLZ: "48201", LAND1: "US", TELF1: "+1-313-555-0300", SMTP_ADDR: "ar@summitmfg.com" },
        { LIFNR: "V-1007", NAME1: "Nordic IT Solutions AB", BUKRS: "2000", STCD1: "TAX-SE778899", IBAN: "SE4550000000058398257466", SWIFT: "ESSESESS", STRAS: "Sveavägen 15", PSTLZ: "111 57", LAND1: "SE", TELF1: "+46-8-123-456", SMTP_ADDR: "payments@nordicit.se" },
        { LIFNR: "V-1008", NAME1: "Atlas Building Materials", BUKRS: "1000", STCD1: "TAX-1123456", IBAN: "US75000000003300059303", SWIFT: "BOFAUS3N", STRAS: "1800 Construction Ave", PSTLZ: "30301", LAND1: "US", TELF1: "+1-404-555-0400", SMTP_ADDR: "invoices@atlasbuilding.com" },
        { LIFNR: "V-1009", NAME1: "Pinnacle Legal Partners LLP", BUKRS: "3000", STCD1: "TAX-6654321", IBAN: "GB82WEST12345698765432", SWIFT: "WESTGB2L", STRAS: "One Canary Wharf", PSTLZ: "E14 5AB", LAND1: "GB", TELF1: "+44-20-7123-4567", SMTP_ADDR: "billing@pinnaclelegal.co.uk" },
        { LIFNR: "V-1010", NAME1: "Green Energy Corp", BUKRS: "2000", STCD1: "TAX-4456789", IBAN: "NL91ABNA0417164300", SWIFT: "ABNANL2A", STRAS: "Herengracht 100", PSTLZ: "1015 BS", LAND1: "NL", TELF1: "+31-20-555-0500", SMTP_ADDR: "finance@greenenergy.nl" },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Vendors");
    const filePath = path.join(OUT_DIR, "SAP_Vendors.xlsx");
    XLSX.writeFile(wb, filePath);
    console.log(`✓ SAP_Vendors.xlsx (${rows.length} rows)`);
}

// ============================================
// 2. SAP CUSTOMERS
// ============================================
function generateCustomers() {
    const rows = [
        { KUNNR: "C-2001", NAME1: "Horizon Enterprises", STCD1: "CTAX-1001", STRAS: "500 Sunset Blvd, Los Angeles, CA", SMTP_ADDR: "ap@horizon.com", TELF1: "+1-213-555-0100", BUKRS: "1000" },
        { KUNNR: "C-2002", NAME1: "Sterling Corp", STCD1: "CTAX-1002", STRAS: "200 Wall Street, New York, NY", SMTP_ADDR: "billing@sterling.com", TELF1: "+1-212-555-0200", BUKRS: "1000" },
        { KUNNR: "C-2003", NAME1: "Apex Dynamics Ltd", STCD1: "CTAX-1003", STRAS: "10 Downing Ct, London, UK", SMTP_ADDR: "finance@apexdynamics.co.uk", TELF1: "+44-20-7946-1234", BUKRS: "2000" },
        { KUNNR: "C-2004", NAME1: "Quantum Solutions AG", STCD1: "CTAX-1004", STRAS: "Bahnhofstrasse 50, Zurich, CH", SMTP_ADDR: "accounts@quantumsolutions.ch", TELF1: "+41-44-123-4567", BUKRS: "3000" },
        { KUNNR: "C-2005", NAME1: "Redline Motors Inc", STCD1: "CTAX-1005", STRAS: "1200 Motor City Dr, Detroit, MI", SMTP_ADDR: "ar@redlinemotors.com", TELF1: "+1-313-555-0500", BUKRS: "1000" },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    const filePath = path.join(OUT_DIR, "SAP_Customers.xlsx");
    XLSX.writeFile(wb, filePath);
    console.log(`✓ SAP_Customers.xlsx (${rows.length} rows)`);
}

// ============================================
// 3. SAP FINANCIAL DOCUMENTS
// ============================================
function generateFinancialDocs() {
    const rows = [
        // These are the historical baseline documents (same as seeded into the DB)
        { BELNR: "DOC-5001", XBLNR: "INV-2024-001", LIFNR: "V-1001", BLDAT: "2024-12-08", BUDAT: "2024-12-09", WRBTR: 12500.00, WAERS: "USD", BUKRS: "1000", ZUONR: "PO-8001" },
        { BELNR: "DOC-5002", XBLNR: "INV-2024-002", LIFNR: "V-1001", BLDAT: "2024-12-21", BUDAT: "2024-12-22", WRBTR: 8750.50, WAERS: "USD", BUKRS: "1000", ZUONR: "PO-8002" },
        { BELNR: "DOC-5003", XBLNR: "INV-2024-003", LIFNR: "V-1002", BLDAT: "2024-12-25", BUDAT: "2024-12-26", WRBTR: 3200.00, WAERS: "GBP", BUKRS: "1000", ZUONR: "PO-8003" },
        { BELNR: "DOC-5004", XBLNR: "INV-2024-004", LIFNR: "V-1003", BLDAT: "2025-01-02", BUDAT: "2025-01-03", WRBTR: 45000.00, WAERS: "EUR", BUKRS: "2000", ZUONR: "PO-8004" },
        { BELNR: "DOC-5005", XBLNR: "INV-2024-005", LIFNR: "V-1004", BLDAT: "2025-01-07", BUDAT: "2025-01-08", WRBTR: 9800.00, WAERS: "USD", BUKRS: "1000", ZUONR: "PO-8005" },
        { BELNR: "DOC-5006", XBLNR: "INV-2024-006", LIFNR: "V-1005", BLDAT: "2025-01-12", BUDAT: "2025-01-13", WRBTR: 22000.00, WAERS: "EUR", BUKRS: "3000", ZUONR: "PO-8006" },
        { BELNR: "DOC-5007", XBLNR: "INV-2024-007", LIFNR: "V-1006", BLDAT: "2025-01-17", BUDAT: "2025-01-18", WRBTR: 15750.75, WAERS: "USD", BUKRS: "1000", ZUONR: "PO-8007" },
        { BELNR: "DOC-5008", XBLNR: "INV-2024-008", LIFNR: "V-1007", BLDAT: "2025-01-22", BUDAT: "2025-01-23", WRBTR: 6300.00, WAERS: "SEK", BUKRS: "2000", ZUONR: "PO-8008" },
        { BELNR: "DOC-5009", XBLNR: "INV-2024-009", LIFNR: "V-1008", BLDAT: "2025-01-27", BUDAT: "2025-01-28", WRBTR: 31200.00, WAERS: "USD", BUKRS: "1000", ZUONR: "PO-8009" },
        { BELNR: "DOC-5010", XBLNR: "INV-2024-010", LIFNR: "V-1009", BLDAT: "2025-02-01", BUDAT: "2025-02-02", WRBTR: 18500.00, WAERS: "GBP", BUKRS: "3000", ZUONR: "PO-8010" },
        { BELNR: "DOC-5011", XBLNR: "INV-2024-011", LIFNR: "V-1010", BLDAT: "2025-02-06", BUDAT: "2025-02-07", WRBTR: 7890.00, WAERS: "EUR", BUKRS: "2000", ZUONR: "PO-8011" },
        { BELNR: "DOC-5012", XBLNR: "INV-2024-012", LIFNR: "V-1001", BLDAT: "2025-02-11", BUDAT: "2025-02-12", WRBTR: 5500.00, WAERS: "USD", BUKRS: "1000", ZUONR: "PO-8012" },
        { BELNR: "DOC-5013", XBLNR: "INV-2024-013", LIFNR: "V-1003", BLDAT: "2025-02-16", BUDAT: "2025-02-17", WRBTR: 28000.00, WAERS: "EUR", BUKRS: "2000", ZUONR: "PO-8013" },
        { BELNR: "DOC-5014", XBLNR: "INV-2024-014", LIFNR: "V-1005", BLDAT: "2025-02-21", BUDAT: "2025-02-22", WRBTR: 41000.00, WAERS: "EUR", BUKRS: "3000", ZUONR: "PO-8014" },
        { BELNR: "DOC-5015", XBLNR: "INV-2024-015", LIFNR: "V-1006", BLDAT: "2025-02-26", BUDAT: "2025-02-27", WRBTR: 11250.00, WAERS: "USD", BUKRS: "1000", ZUONR: "PO-8015" },
    ];

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Financial Documents");
    const filePath = path.join(OUT_DIR, "SAP_Financial_Documents.xlsx");
    XLSX.writeFile(wb, filePath);
    console.log(`✓ SAP_Financial_Documents.xlsx (${rows.length} rows)`);
}

// ============================================
// 4. PAYMENT GATE TEST CSV
// ============================================
function generatePaymentProposal() {
    // This file is designed to test the Payment Gate duplicate detection engine.
    // It contains:
    //   - 4 EXACT duplicates of historical baseline invoices (should flag as DUPLICATE/Critical)
    //   - 3 FUZZY duplicates (slight typos in invoice numbers, same amounts — should flag as FLAGGED/High)
    //   - 3 WITHIN-BATCH duplicates (same invoice appears twice in this file)
    //   - 10 CLEAN invoices (no match expected)
    const rows = [
        // --- EXACT DUPLICATES of historical baseline (INV-2024-001, 002, 005, 012) ---
        { "Invoice Number": "INV-2024-001", "Vendor ID": "V-1001", Amount: "12500.00", "Invoice Date": "2024-12-08", "Company Code": "1000" },
        { "Invoice Number": "INV-2024-002", "Vendor ID": "V-1001", Amount: "8750.50", "Invoice Date": "2024-12-21", "Company Code": "1000" },
        { "Invoice Number": "INV-2024-005", "Vendor ID": "V-1004", Amount: "9800.00", "Invoice Date": "2025-01-07", "Company Code": "1000" },
        { "Invoice Number": "INV-2024-012", "Vendor ID": "V-1001", Amount: "5500.00", "Invoice Date": "2025-02-11", "Company Code": "1000" },

        // --- FUZZY DUPLICATES (OCR-style typos, same vendor+amount) ---
        { "Invoice Number": "INV-2O24-004", "Vendor ID": "V-1003", Amount: "45000.00", "Invoice Date": "2025-01-05", "Company Code": "2000" },  // O instead of 0
        { "Invoice Number": "INV-2024-O07", "Vendor ID": "V-1006", Amount: "15750.75", "Invoice Date": "2025-01-20", "Company Code": "1000" },  // O instead of 0
        { "Invoice Number": "INV-2024-0l0", "Vendor ID": "V-1009", Amount: "18500.00", "Invoice Date": "2025-02-03", "Company Code": "3000" },  // l instead of 1

        // --- WITHIN-BATCH DUPLICATES (these two appear twice in THIS file) ---
        { "Invoice Number": "INV-NEW-7001", "Vendor ID": "V-1002", Amount: "4200.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-7001", "Vendor ID": "V-1002", Amount: "4200.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },  // Exact copy
        { "Invoice Number": "INV-NEW-7002", "Vendor ID": "V-1008", Amount: "19500.00", "Invoice Date": "2025-03-02", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-7002", "Vendor ID": "V-1008", Amount: "19500.00", "Invoice Date": "2025-03-02", "Company Code": "1000" },  // Exact copy

        // --- CLEAN INVOICES (no historical match expected) ---
        { "Invoice Number": "INV-NEW-8001", "Vendor ID": "V-1001", Amount: "3750.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-8002", "Vendor ID": "V-1002", Amount: "6100.25", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-8003", "Vendor ID": "V-1003", Amount: "14200.00", "Invoice Date": "2025-03-01", "Company Code": "2000" },
        { "Invoice Number": "INV-NEW-8004", "Vendor ID": "V-1004", Amount: "2800.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-8005", "Vendor ID": "V-1005", Amount: "55000.00", "Invoice Date": "2025-03-01", "Company Code": "3000" },
        { "Invoice Number": "INV-NEW-8006", "Vendor ID": "V-1006", Amount: "8900.50", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-8007", "Vendor ID": "V-1007", Amount: "11300.00", "Invoice Date": "2025-03-02", "Company Code": "2000" },
        { "Invoice Number": "INV-NEW-8008", "Vendor ID": "V-1008", Amount: "7250.75", "Invoice Date": "2025-03-02", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-8009", "Vendor ID": "V-1009", Amount: "33000.00", "Invoice Date": "2025-03-02", "Company Code": "3000" },
        { "Invoice Number": "INV-NEW-8010", "Vendor ID": "V-1010", Amount: "4500.00", "Invoice Date": "2025-03-02", "Company Code": "2000" },
    ];

    // Write as both CSV and Excel
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payment Proposal");

    // Excel version
    XLSX.writeFile(wb, path.join(OUT_DIR, "Payment_Proposal_Test.xlsx"));

    // CSV version
    const csv = XLSX.utils.sheet_to_csv(ws);
    fs.writeFileSync(path.join(OUT_DIR, "Payment_Proposal_Test.csv"), csv);

    console.log(`✓ Payment_Proposal_Test.xlsx and .csv (${rows.length} rows)`);
    console.log(`    → 4 exact duplicates, 3 fuzzy duplicates, 4 within-batch duplicates, 10 clean`);
}

// ============================================
// MAIN
// ============================================
console.log("=== GENERATING TEST DATA FILES ===\n");
console.log(`Output directory: ${OUT_DIR}\n`);

generateVendors();
generateCustomers();
generateFinancialDocs();
generatePaymentProposal();

console.log("\n=== ALL TEST FILES GENERATED ===");
console.log("Files are accessible at: http://localhost:3000/test-data/");
console.log("  - SAP_Vendors.xlsx");
console.log("  - SAP_Customers.xlsx");
console.log("  - SAP_Financial_Documents.xlsx");
console.log("  - Payment_Proposal_Test.xlsx");
console.log("  - Payment_Proposal_Test.csv");
