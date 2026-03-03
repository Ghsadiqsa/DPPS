import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { vendors, invoices, customers, financialDocuments } from '../src/lib/schema';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const OUT_DIR = path.resolve(__dirname, '../public/test-data');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function daysAgo(n: number): Date {
    const d = new Date(); d.setDate(d.getDate() - n); return d;
}

async function main() {
    console.log("=== STEP 1: CLEAR ALL DUPLICATE / FLAGGED INVOICES ===");
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
    console.log("✓ All operational tables cleared.\n");

    // ===== RE-SEED VENDORS =====
    console.log("=== STEP 2: SEED FRESH MASTER DATA ===");
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
        await db.insert(vendors).values({ ...v, totalSpend: "0", duplicateCount: 0 });
    }
    console.log(`✓ ${vendorData.length} vendors seeded.`);

    // Customers
    const customerData = [
        { customerNumber: "C-2001", name: "Horizon Enterprises", taxId: "CTAX-1001", billingAddress: "500 Sunset Blvd, Los Angeles, CA", email: "ap@horizon.com", phone: "+1-213-555-0100", companyCode: "1000" },
        { customerNumber: "C-2002", name: "Sterling Corp", taxId: "CTAX-1002", billingAddress: "200 Wall Street, New York, NY", email: "billing@sterling.com", phone: "+1-212-555-0200", companyCode: "1000" },
        { customerNumber: "C-2003", name: "Apex Dynamics Ltd", taxId: "CTAX-1003", billingAddress: "10 Downing Ct, London, UK", email: "finance@apexdynamics.co.uk", phone: "+44-20-7946-1234", companyCode: "2000" },
        { customerNumber: "C-2004", name: "Quantum Solutions AG", taxId: "CTAX-1004", billingAddress: "Bahnhofstrasse 50, Zurich, CH", email: "accounts@quantumsolutions.ch", phone: "+41-44-123-4567", companyCode: "3000" },
        { customerNumber: "C-2005", name: "Redline Motors Inc", taxId: "CTAX-1005", billingAddress: "1200 Motor City Dr, Detroit, MI", email: "ar@redlinemotors.com", phone: "+1-313-555-0500", companyCode: "1000" },
    ];
    for (const c of customerData) { await db.insert(customers).values(c); }
    console.log(`✓ ${customerData.length} customers seeded.`);

    // ===== HISTORICAL FINANCIAL DOCUMENTS (baseline for detection) =====
    console.log("\n=== STEP 3: SEED HISTORICAL BASELINE ===");
    const finDocs = [
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
    ];
    for (const doc of finDocs) { await db.insert(financialDocuments).values(doc); }
    console.log(`✓ ${finDocs.length} historical financial documents seeded.`);

    // ===== GENERATE HISTORICAL LOAD EXCEL FILES =====
    console.log("\n=== STEP 4: GENERATE HISTORICAL LOAD EXCEL FILES ===");

    // Vendors Excel (SAP format)
    writeExcel("SAP_Vendors_HistLoad.xlsx", "Vendors", vendorData.map(v => ({
        LIFNR: v.id, NAME1: v.name, BUKRS: v.companyCode, STCD1: v.taxId, IBAN: v.iban,
        SWIFT: v.swiftBic, STRAS: v.addressLine1, PSTLZ: v.postalCode, LAND1: v.country,
        TELF1: v.phoneNumber, SMTP_ADDR: v.email
    })));

    // Customers Excel (SAP format)
    writeExcel("SAP_Customers_HistLoad.xlsx", "Customers", customerData.map(c => ({
        KUNNR: c.customerNumber, NAME1: c.name, STCD1: c.taxId, STRAS: c.billingAddress,
        SMTP_ADDR: c.email, TELF1: c.phone, BUKRS: c.companyCode
    })));

    // Financial Documents Excel (SAP format)
    writeExcel("SAP_FinDocs_HistLoad.xlsx", "Financial Documents", finDocs.map(d => ({
        BELNR: d.documentNumber, XBLNR: d.invoiceNumber, LIFNR: d.vendorId,
        BLDAT: d.invoiceDate.toISOString().split('T')[0], BUDAT: d.postingDate.toISOString().split('T')[0],
        WRBTR: parseFloat(d.amount), WAERS: d.currency, BUKRS: d.companyCode, ZUONR: d.referenceNumber
    })));

    // ===== GENERATE 4 PAYMENT GATE SCENARIOS =====
    console.log("\n=== STEP 5: GENERATE 4 PAYMENT GATE TEST SCENARIOS ===\n");

    // ---------- SCENARIO 1: Exact Duplicates ----------
    const s1 = [
        { "Invoice Number": "INV-2024-001", "Vendor ID": "V-1001", Amount: "12500.00", "Invoice Date": "2024-12-08", "Company Code": "1000" },
        { "Invoice Number": "INV-2024-002", "Vendor ID": "V-1001", Amount: "8750.50", "Invoice Date": "2024-12-21", "Company Code": "1000" },
        { "Invoice Number": "INV-2024-005", "Vendor ID": "V-1004", Amount: "9800.00", "Invoice Date": "2025-01-07", "Company Code": "1000" },
        { "Invoice Number": "INV-2024-012", "Vendor ID": "V-1001", Amount: "5500.00", "Invoice Date": "2025-02-11", "Company Code": "1000" },
        // Clean invoices
        { "Invoice Number": "INV-NEW-A001", "Vendor ID": "V-1003", Amount: "14200.00", "Invoice Date": "2025-03-01", "Company Code": "2000" },
        { "Invoice Number": "INV-NEW-A002", "Vendor ID": "V-1006", Amount: "8900.50", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-A003", "Vendor ID": "V-1010", Amount: "4500.00", "Invoice Date": "2025-03-02", "Company Code": "2000" },
    ];
    writeExcelAndCsv("Scenario1_Exact_Duplicates", s1);
    console.log("✓ Scenario 1: Exact Duplicates (4 exact matches + 3 clean = 7 rows)");
    console.log("  Expected: 4 HELD (score 100, critical), 3 APPROVED\n");

    // ---------- SCENARIO 2: Fuzzy / OCR Duplicates ----------
    const s2 = [
        { "Invoice Number": "INV-2O24-004", "Vendor ID": "V-1003", Amount: "45000.00", "Invoice Date": "2025-01-05", "Company Code": "2000" },  // O instead of 0
        { "Invoice Number": "INV-2024-O07", "Vendor ID": "V-1006", Amount: "15750.75", "Invoice Date": "2025-01-20", "Company Code": "1000" },  // O instead of 0
        { "Invoice Number": "INV-2024-0l0", "Vendor ID": "V-1009", Amount: "18500.00", "Invoice Date": "2025-02-03", "Company Code": "3000" },  // l (lowercase L) instead of 1
        { "Invoice Number": "lNV-2024-003", "Vendor ID": "V-1002", Amount: "3200.00", "Invoice Date": "2024-12-27", "Company Code": "1000" },  // l instead of I
        // Clean invoices
        { "Invoice Number": "INV-NEW-B001", "Vendor ID": "V-1005", Amount: "55000.00", "Invoice Date": "2025-03-01", "Company Code": "3000" },
        { "Invoice Number": "INV-NEW-B002", "Vendor ID": "V-1007", Amount: "11300.00", "Invoice Date": "2025-03-02", "Company Code": "2000" },
        { "Invoice Number": "INV-NEW-B003", "Vendor ID": "V-1008", Amount: "7250.75", "Invoice Date": "2025-03-02", "Company Code": "1000" },
    ];
    writeExcelAndCsv("Scenario2_Fuzzy_OCR_Duplicates", s2);
    console.log("✓ Scenario 2: Fuzzy/OCR Duplicates (4 fuzzy matches + 3 clean = 7 rows)");
    console.log("  Expected: 4 HELD (score ~98, critical), 3 APPROVED\n");

    // ---------- SCENARIO 3: Within-Batch Duplicates ----------
    const s3 = [
        { "Invoice Number": "INV-BATCH-9001", "Vendor ID": "V-1002", Amount: "4200.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-BATCH-9001", "Vendor ID": "V-1002", Amount: "4200.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },  // exact copy
        { "Invoice Number": "INV-BATCH-9002", "Vendor ID": "V-1004", Amount: "19500.00", "Invoice Date": "2025-03-02", "Company Code": "1000" },
        { "Invoice Number": "INV-BATCH-9002", "Vendor ID": "V-1004", Amount: "19500.00", "Invoice Date": "2025-03-02", "Company Code": "1000" },  // exact copy
        { "Invoice Number": "INV-BATCH-9003", "Vendor ID": "V-1008", Amount: "8800.00", "Invoice Date": "2025-03-02", "Company Code": "1000" },
        { "Invoice Number": "INV-BATCH-9003", "Vendor ID": "V-1008", Amount: "8800.00", "Invoice Date": "2025-03-02", "Company Code": "1000" },  // exact copy
        // Clean invoices
        { "Invoice Number": "INV-NEW-C001", "Vendor ID": "V-1001", Amount: "3750.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-C002", "Vendor ID": "V-1009", Amount: "33000.00", "Invoice Date": "2025-03-02", "Company Code": "3000" },
    ];
    writeExcelAndCsv("Scenario3_Within_Batch_Duplicates", s3);
    console.log("✓ Scenario 3: Within-Batch Duplicates (3 pairs of identical invoices + 2 clean = 8 rows)");
    console.log("  Expected: 6 HELD (score 100, critical), 2 APPROVED\n");

    // ---------- SCENARIO 4: Mixed (All Types Combined) ----------
    const s4 = [
        // Exact duplicate of historical
        { "Invoice Number": "INV-2024-006", "Vendor ID": "V-1005", Amount: "22000.00", "Invoice Date": "2025-01-12", "Company Code": "3000" },
        // Fuzzy duplicate of historical
        { "Invoice Number": "INV-2024-O09", "Vendor ID": "V-1008", Amount: "31200.00", "Invoice Date": "2025-01-30", "Company Code": "1000" },  // O instead of 0
        // Within-batch duplicate pair
        { "Invoice Number": "INV-MIX-5001", "Vendor ID": "V-1003", Amount: "16750.00", "Invoice Date": "2025-03-01", "Company Code": "2000" },
        { "Invoice Number": "INV-MIX-5001", "Vendor ID": "V-1003", Amount: "16750.00", "Invoice Date": "2025-03-01", "Company Code": "2000" },  // copy
        // Near-amount match (fuzzy amount — same vendor, same invoice number pattern, amount off by 0.01%)
        { "Invoice Number": "INV-2024-011", "Vendor ID": "V-1010", Amount: "7890.00", "Invoice Date": "2025-02-08", "Company Code": "2000" },
        // Clean invoices
        { "Invoice Number": "INV-NEW-D001", "Vendor ID": "V-1001", Amount: "2100.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-D002", "Vendor ID": "V-1004", Amount: "6700.00", "Invoice Date": "2025-03-01", "Company Code": "1000" },
        { "Invoice Number": "INV-NEW-D003", "Vendor ID": "V-1007", Amount: "9400.00", "Invoice Date": "2025-03-02", "Company Code": "2000" },
        { "Invoice Number": "INV-NEW-D004", "Vendor ID": "V-1005", Amount: "13500.00", "Invoice Date": "2025-03-02", "Company Code": "3000" },
        { "Invoice Number": "INV-NEW-D005", "Vendor ID": "V-1006", Amount: "27800.00", "Invoice Date": "2025-03-02", "Company Code": "1000" },
    ];
    writeExcelAndCsv("Scenario4_Mixed_All_Types", s4);
    console.log("✓ Scenario 4: Mixed (1 exact + 1 fuzzy + 2 within-batch + 1 exact amount + 5 clean = 10 rows)");
    console.log("  Expected: 5 HELD/FLAGGED, 5 APPROVED\n");

    console.log("=== ALL DONE ===");
    console.log("Download the files at:");
    console.log("  Historical Load:");
    console.log("    http://localhost:3000/test-data/SAP_Vendors_HistLoad.xlsx");
    console.log("    http://localhost:3000/test-data/SAP_Customers_HistLoad.xlsx");
    console.log("    http://localhost:3000/test-data/SAP_FinDocs_HistLoad.xlsx");
    console.log("  Payment Gate Scenarios:");
    console.log("    http://localhost:3000/test-data/Scenario1_Exact_Duplicates.csv");
    console.log("    http://localhost:3000/test-data/Scenario2_Fuzzy_OCR_Duplicates.csv");
    console.log("    http://localhost:3000/test-data/Scenario3_Within_Batch_Duplicates.csv");
    console.log("    http://localhost:3000/test-data/Scenario4_Mixed_All_Types.csv");
}

function writeExcel(filename: string, sheetName: string, rows: any[]) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, path.join(OUT_DIR, filename));
    console.log(`✓ ${filename} (${rows.length} rows)`);
}

function writeExcelAndCsv(baseName: string, rows: any[]) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Payment Proposal");
    XLSX.writeFile(wb, path.join(OUT_DIR, `${baseName}.xlsx`));
    const csv = XLSX.utils.sheet_to_csv(ws);
    fs.writeFileSync(path.join(OUT_DIR, `${baseName}.csv`), csv);
}

main().catch(err => { console.error("FAILED:", err); process.exit(1); });
