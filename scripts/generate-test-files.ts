import * as xlsx from 'xlsx';
import * as fs from 'fs';

function generateRandomString(length: number) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

function generateData() {
    console.log("Generating Historical Data (50 records)...");
    const historicalData = [];
    const vendors = ['V-1001', 'V-1002', 'V-1003', 'V-1004', 'V-1005'];

    // Create 50 historical records
    for (let i = 1; i <= 50; i++) {
        historicalData.push({
            'Document Number': `DOC-HIST-${1000 + i}`,
            'Invoice Number': `INV-H-${2000 + i}`,
            'Vendor ID': vendors[i % vendors.length],
            'Amount': (Math.random() * 5000 + 100).toFixed(2),
            'Invoice Date': new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
            'Company Code': 'CC-001',
            'Currency': 'USD'
        });
    }

    // Generate 20 payment proposals
    console.log("Generating Payment Proposals (20 records)...");
    const proposalsData = [];

    // 1-5: Exact Duplicates of the first 5 historical records
    for (let i = 0; i < 5; i++) {
        proposalsData.push({
            'Invoice Number': historicalData[i]['Invoice Number'],
            'Vendor ID': historicalData[i]['Vendor ID'],
            'Amount': historicalData[i]['Amount'],
            'Invoice Date': historicalData[i]['Invoice Date'],
            'Company Code': historicalData[i]['Company Code']
        });
    }

    // 6-10: Partial Duplicates of historical records 10-14 (Same vendor/amount, typo in invoice)
    for (let i = 10; i < 15; i++) {
        proposalsData.push({
            'Invoice Number': historicalData[i]['Invoice Number'] + '-X', // Typo
            'Vendor ID': historicalData[i]['Vendor ID'],
            'Amount': historicalData[i]['Amount'],
            'Invoice Date': historicalData[i]['Invoice Date'],
            'Company Code': historicalData[i]['Company Code']
        });
    }

    // 11-20: Clean Records (No match to historical)
    for (let i = 1; i <= 10; i++) {
        proposalsData.push({
            'Invoice Number': `INV-NEW-${9000 + i}`,
            'Vendor ID': `V-999${i}`, // New vendors
            'Amount': (Math.random() * 5000 + 100).toFixed(2),
            'Invoice Date': new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
            'Company Code': 'CC-001'
        });
    }

    // Write Historical to Excel
    const wsHist = xlsx.utils.json_to_sheet(historicalData);
    const wbHist = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wbHist, wsHist, 'Historical Data');
    xlsx.writeFile(wbHist, 'test-historical-data.xlsx');
    console.log("Created test-historical-data.xlsx");

    // Write Proposals to Excel
    const wsProp = xlsx.utils.json_to_sheet(proposalsData);
    const wbProp = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wbProp, wsProp, 'Payment Proposals');
    xlsx.writeFile(wbProp, 'test-payment-proposals.xlsx');
    console.log("Created test-payment-proposals.xlsx");
}

try {
    generateData();
    console.log("Successfully generated both Excel files.");
} catch (error) {
    console.error("Error generating files:", error);
}
