import * as xlsx from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION ---
const PACK_DIR = path.join(process.cwd(), 'test-data-pack');
const CSV_DIR = path.join(PACK_DIR, 'CSV_Versions');

if (!fs.existsSync(PACK_DIR)) fs.mkdirSync(PACK_DIR);
if (!fs.existsSync(CSV_DIR)) fs.mkdirSync(CSV_DIR);

const erpTypes = ['SAP', 'Oracle', 'Dynamics', 'Sage', 'Other'];
const companyCodes = ['1000', '2000', '3000', '4000', '5000', '6000'];
const currencies = ['USD', 'EUR', 'GBP', 'GHS', 'SEK'];

// --- HELPERS ---
const randomElement = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const formatDate = (date: Date) => date.toISOString().split('T')[0];
const daysAgo = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
};

// --- DATA GENERATORS ---

function generateVendors(count: number) {
    const vendors = [];
    for (let i = 1; i <= count; i++) {
        const erp = randomElement(erpTypes);
        const cc = randomElement(companyCodes);
        const id = `V-${erp}-${cc}-${1000 + i}`;
        vendors.push({
            erp_type: erp,
            company_code: cc,
            vendor_id: id,
            vendor_name: `Vendor ${i} ${erp} Solutions`,
            tax_id: `TAX-${Math.floor(Math.random() * 899999) + 100000}`,
            iban_or_bank_account: `IBAN${Math.floor(Math.random() * 8999999999) + 1000000000}`,
            currency: randomElement(currencies),
            country: randomElement(['US', 'DE', 'GB', 'FR', 'GH', 'SE']),
            address_line1: `${i} Industry St`,
            email: `ap@vendor${i}.com`,
            phone: `+1-555-0${i}`,
            status: 'ACTIVE'
        });
    }
    // Add intentional name duplicates
    for (let i = 0; i < 10; i++) {
        const base = vendors[i];
        vendors.push({
            ...base,
            vendor_id: base.vendor_id + '-DUP',
            vendor_name: base.vendor_name + ' LTD'
        });
    }
    return vendors;
}

function generateFinDocs(vendors: any[], count: number) {
    const docs = [];
    for (let i = 1; i <= count; i++) {
        const vendor = randomElement(vendors);
        const amount = (Math.random() * 50000 + 10).toFixed(2);
        const tax = (parseFloat(amount) * 0.1).toFixed(2);
        const net = (parseFloat(amount) - parseFloat(tax)).toFixed(2);
        const date = daysAgo(Math.floor(Math.random() * 365));

        docs.push({
            erp_type: vendor.erp_type,
            company_code: vendor.company_code,
            document_id: `DOC-${200000 + i}`,
            document_type: 'INVOICE',
            vendor_id: vendor.vendor_id,
            invoice_number: `INV-${300000 + i}`,
            invoice_date: formatDate(date),
            posting_date: formatDate(date),
            currency: vendor.currency,
            gross_amount: amount,
            net_amount: net,
            tax_amount: tax,
            po_number: Math.random() > 0.3 ? `PO-${400000 + i}` : '',
            payment_terms: 'N30',
            baseline_date: formatDate(date),
            status: 'PAID',
            payment_date: formatDate(date),
            payment_reference: `PAY-${500000 + i}`,
            created_at: date.toISOString()
        });
    }
    return docs;
}

function generatePaymentGate(vendors: any[], historical: any[]) {
    const proposals = [];

    // 1. Clean data (150)
    for (let i = 0; i < 150; i++) {
        const v = randomElement(vendors);
        proposals.push({
            'Invoice Number': `PROP-CLEAN-${100 + i}`,
            'Vendor ID': v.vendor_id,
            'Amount': (Math.random() * 10000 + 50).toFixed(2),
            'Invoice Date': formatDate(new Date()),
            'Company Code': v.company_code
        });
    }

    // 2. Exact Duplicates of History (20)
    for (let i = 0; i < 20; i++) {
        const h = historical[i];
        proposals.push({
            'Invoice Number': h.invoice_number,
            'Vendor ID': h.vendor_id,
            'Amount': h.gross_amount,
            'Invoice Date': h.invoice_date,
            'Company Code': h.company_code
        });
    }

    // 3. Fuzzy Matches (20)
    for (let i = 20; i < 40; i++) {
        const h = historical[i];
        proposals.push({
            'Invoice Number': h.invoice_number.replace('0', 'O').replace('1', 'I'),
            'Vendor ID': h.vendor_id,
            'Amount': h.gross_amount,
            'Invoice Date': h.invoice_date,
            'Company Code': h.company_code
        });
    }

    // 4. Borderline (Near Match Amount) (20)
    for (let i = 40; i < 60; i++) {
        const h = historical[i];
        proposals.push({
            'Invoice Number': `INV-NEAR-${i}`,
            'Vendor ID': h.vendor_id,
            'Amount': (parseFloat(h.gross_amount) + 0.01).toFixed(2),
            'Invoice Date': h.invoice_date,
            'Company Code': h.company_code
        });
    }

    // 5. Cross-batch duplicates (40) - Intentionally duplicate within this proposal batch
    for (let i = 0; i < 20; i++) {
        const inv = `PROP-BATCH-DUP-${i}`;
        const v = randomElement(vendors);
        const row = {
            'Invoice Number': inv,
            'Vendor ID': v.vendor_id,
            'Amount': '1250.00',
            'Invoice Date': formatDate(new Date()),
            'Company Code': v.company_code
        };
        proposals.push(row);
        proposals.push({ ...row }); // Duplicate
    }

    return proposals;
}

function generateScenarioCatalogue() {
    const scenarios = [
        { id: 'SC-001', name: 'Exact Duplicate', match: 'Exact', outcome: 'BLOCK', risk: 'Critical', desc: 'Same vendor, number, amount, date' },
        { id: 'SC-002', name: 'Invoice Number Reused', match: 'Exact Vendor + #', outcome: 'REVIEW', risk: 'High', desc: 'Same vendor + invoice number, different amount/date' },
        { id: 'SC-003', name: 'Fuzzy Invoice Number', match: 'Levenshtein > 80%', outcome: 'REVIEW', risk: 'Medium/High', desc: 'Typos: 0/O, 1/I, missing dash' },
        { id: 'SC-004', name: 'Same Amount + Same Date', match: 'Partial', outcome: 'REVIEW', risk: 'Medium', desc: 'Different invoice number' },
        { id: 'SC-005', name: 'Close Date Window', match: 'Fuzzy', outcome: 'REVIEW', risk: 'Medium', desc: 'Same vendor + # + amount, date ± 3 days' },
        { id: 'SC-006', name: 'Split Invoice', match: 'Fuzzy Amount', outcome: 'INVESTIGATE', risk: 'High', desc: 'One invoice split into two amounts' },
        { id: 'SC-007', name: 'Merged Invoice', match: 'Fuzzy Amount', outcome: 'INVESTIGATE', risk: 'High', desc: 'Two invoices merged into one' },
        { id: 'SC-008', name: 'Credit Memo Masking', match: 'Amount Balance', outcome: 'FLAG', risk: 'Medium', desc: 'Invoice + Credit Memo equals zero' },
        { id: 'SC-009', name: 'Cross-Company Duplicate', match: 'Cross-Entity', outcome: 'FLAG', risk: 'Medium', desc: 'Same vendor code in CC 1000 vs 2000' },
        { id: 'SC-010', name: 'Currency Variance', match: 'Base Amount', outcome: 'REVIEW', risk: 'Medium', desc: 'Same amount, different currency' },
        { id: 'SC-011', name: 'Paid Duplicate', match: 'Historical', outcome: 'RECOVERY', risk: 'Critical', desc: 'Paid in history, appears in gate' },
        { id: 'SC-012', name: 'Same IBAN, Diff Vendor', match: 'Bank Match', outcome: 'INVESTIGATE', risk: 'Critical', desc: 'Internal fraud or master data error' },
        { id: 'SC-013', name: 'PO-based Duplicate', match: 'PO Match', outcome: 'BLOCK', risk: 'High', desc: 'Same PO, diff Inv #' },
        { id: 'SC-014', name: 'Non-PO Duplicate', match: 'Fields Match', outcome: 'BLOCK', risk: 'High', desc: 'Standard field matches' },
        { id: 'SC-015', name: 'False Positive Control', match: 'None', outcome: 'ALLOW', risk: 'Low', desc: 'Very similar but logically different' },
    ];

    const data = [];
    for (const sc of scenarios) {
        for (let i = 1; i <= 55; i++) {
            data.push({
                'Scenario ID': sc.id,
                'Scenario Name': sc.name,
                'Step Number': i % 5 === 0 ? 'Verification' : 'Input',
                'Invoice Number': `TEST-${sc.id}-${1000 + i}`,
                'Vendor ID': `V-SCEN-${sc.id}`,
                'Amount': (Math.random() * 5000).toFixed(2),
                'Invoice Date': formatDate(new Date()),
                'Expected Match Type': sc.match,
                'Expected Outcome': sc.outcome,
                'Risk Score Range': sc.risk === 'Critical' ? '90-100' : (sc.risk === 'High' ? '70-90' : '30-70'),
                'Notes': i === 1 ? sc.desc : ''
            });
        }
    }
    return data;
}

// --- MAIN EXECUTION ---

async function main() {
    console.log("🛠️  Building E2E Test Data Pack...");

    const vendors = generateVendors(150);
    const historical = generateFinDocs(vendors, 1000);
    const gateProp = generatePaymentGate(vendors, historical);
    const catalogue = generateScenarioCatalogue();

    // Create main TestDataPack.xlsx
    const wbPack = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wbPack, xlsx.utils.json_to_sheet(vendors), 'VENDORS');
    xlsx.utils.book_append_sheet(wbPack, xlsx.utils.json_to_sheet(historical), 'FINANCIAL_DOCS');
    xlsx.utils.book_append_sheet(wbPack, xlsx.utils.json_to_sheet(gateProp), 'PAYMENT_GATE_UPLOAD');
    xlsx.writeFile(wbPack, path.join(PACK_DIR, 'DPPS_TestDataPack.xlsx'));

    // Create SCENARIO_CATALOGUE.xlsx
    const wbCat = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wbCat, xlsx.utils.json_to_sheet(catalogue), 'SCENARIOS');
    xlsx.writeFile(wbCat, path.join(PACK_DIR, 'DPPS_ScenarioCatalogue.xlsx'));

    // Save CSVs
    const saveCSV = (data: any[], filename: string) => {
        const ws = xlsx.utils.json_to_sheet(data);
        const csv = xlsx.utils.sheet_to_csv(ws);
        fs.writeFileSync(path.join(CSV_DIR, `${filename}.csv`), csv);
    };

    saveCSV(vendors, 'VENDORS');
    saveCSV(historical, 'FINANCIAL_DOCS');
    saveCSV(gateProp, 'PAYMENT_GATE_UPLOAD');
    saveCSV(catalogue, 'SCENARIO_CATALOGUE');

    // Create README
    const readme = `# DPPS End-to-End Test Data Pack

## Files Included:
- **DPPS_TestDataPack.xlsx**: The primary data source.
  - \`VENDORS\`: 150 Master data records.
  - \`FINANCIAL_DOC_HISTORY\`: 1000 historical paid invoices.
  - \`PAYMENT_GATE_UPLOAD\`: 250 rows for the proposal gate.
- **DPPS_ScenarioCatalogue.xlsx**: Breakdown of 15 standard duplicate scenarios.
- **CSV_Versions/**: Flattened versions of all sheets for quick CLI testing.

## E2E Workflow Steps:
1. **Import Vendors**: Go to Historical Load -> Change Entity to "Vendors" -> Upload \`VENDORS.csv\`.
2. **Import History**: Go to Historical Load -> Change Entity to "Financial Documents" -> Upload \`FINANCIAL_DOCS.csv\`.
3. **Run Detection Baseline**: Wait for the background worker to process historical matches (Automatic).
4. **Trigger Payment Gate**: Go to Payment Gate -> Upload \`PAYMENT_GATE_UPLOAD.csv\`.
5. **Verify Outcomes**:
   - Confirm SC-001 triggers an Exact match BLOCK.
   - Confirm SC-003 (Fuzzy) triggers a REVIEW case.
   - Confirm SC-011 (Paid) triggers a RECOVERY case.

## Data Rules:
- Currency: USD, EUR, GBP, GHS, SEK.
- Date Format: YYYY-MM-DD.
- Logical Check: gross_amount = net_amount + tax_amount.
`;
    fs.writeFileSync(path.join(PACK_DIR, 'README_TestDataPack.md'), readme);

    console.log("✅  Data Pack Generated in /test-data-pack/");
}

main().catch(console.error);
