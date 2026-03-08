import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

const PUBLIC_TEMPLATES = path.join(process.cwd(), 'public', 'templates');

if (!fs.existsSync(PUBLIC_TEMPLATES)) {
    fs.mkdirSync(PUBLIC_TEMPLATES, { recursive: true });
}

function generateExcel(filename: string, data: any[][]) {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, path.join(PUBLIC_TEMPLATES, filename));
    console.log(`Generated: ${filename}`);
}

// 1. Historical Vendors Template (Generic/Other)
generateExcel('historical_vendors.xlsx', [
    ['Vendor ID (*)', 'Vendor Name (*)', 'Company Codes', 'Tax ID (*)', 'IBAN (*)', 'Address Line 1 (*)', 'Postal Code (*)', 'Country (*)', 'Email'],
    ['V-1001', 'Acme Corp', 'CC01', 'TX-999', 'GB123456789', '123 Acme St', 'EC1A 1BB', 'UK', 'finance@acme.com']
]);

// 2. Historical Customers Template
generateExcel('historical_customers.xlsx', [
    ['Customer ID (*)', 'Customer Name (*)', 'Company Codes', 'Tax ID (*)', 'Address (*)'],
    ['C-2001', 'Global Industries', 'CC01', 'TX-888', '456 Global Way']
]);

// 3. Historical Financials Template
generateExcel('historical_financials.xlsx', [
    ['Document Number (*)', 'Invoice Number (*)', 'Entity ID (*)', 'Invoice Date (*)', 'Posting Date (*)', 'Amount (*)', 'Currency (*)', 'Company Code (*)'],
    ['DOC-0001', 'INV-555', 'V-1001', '2026-01-01', '2026-01-05', '1500.00', 'USD', 'CC01']
]);

// 4. Test Proposal Scenarios Template
generateExcel('proposal_scenarios.xlsx', [
    ['Invoice Number', 'Vendor ID', 'Amount', 'Invoice Date'],
    // Scenario 1: Exact Duplicate (matches seeded ACME-2025-001)
    ['ACME-2025-001', 'ACME-001', '15000.00', new Date().toISOString().split('T')[0]],
    // Scenario 2: Fuzzy Match - OCR Error (O vs 0)
    ['ACME-2O25-001', 'ACME-001', '15000.00', new Date().toISOString().split('T')[0]],
    // Scenario 3: Fuzzy Match - Suffix
    ['ACME-2025-001-DUP', 'ACME-001', '15000.00', new Date().toISOString().split('T')[0]],
    // Scenario 4: Clean Release
    ['RELEASE-INV-2026', 'GLOBEX-002', '450.75', new Date().toISOString().split('T')[0]]
]);

console.log('All templates generated successfully!');
