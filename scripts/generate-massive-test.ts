import * as xlsx from 'xlsx';
import * as fs from 'fs';

function generateData() {
    console.log("Generating Historical Data (1000 records)...");
    const historicalData = [];
    const vendors = Array.from({ length: 50 }, (_, i) => `V-${1000 + i}`);

    // Create 1000 historical records
    for (let i = 1; i <= 1000; i++) {
        historicalData.push({
            'Document Number': `DOC-HIST-${10000 + i}`,
            'Invoice Number': `INV-H-${20000 + i}`,
            'Vendor ID': vendors[i % vendors.length],
            'Amount': (Math.random() * 5000 + 100).toFixed(2),
            'Invoice Date': new Date(2023, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
            'Company Code': 'CC-001',
            'Currency': 'USD'
        });
    }

    // Write Historical to Excel
    const wsHist = xlsx.utils.json_to_sheet(historicalData);
    const wbHist = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wbHist, wsHist, 'Historical Data');
    xlsx.writeFile(wbHist, 'test-historical-1000.xlsx');
    console.log("Created test-historical-1000.xlsx");

    // Scenario 1: Exact Duplicates (20 records)
    console.log("Generating Scenario 1: Exact Duplicates...");
    const scenario1 = [];
    for (let i = 0; i < 20; i++) {
        scenario1.push({
            'Invoice Number': historicalData[i]['Invoice Number'],
            'Vendor ID': historicalData[i]['Vendor ID'],
            'Amount': historicalData[i]['Amount'],
            'Invoice Date': historicalData[i]['Invoice Date'],
            'Company Code': historicalData[i]['Company Code']
        });
    }
    const wb1 = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb1, xlsx.utils.json_to_sheet(scenario1), 'Scenario 1');
    xlsx.writeFile(wb1, 'test-scenario-1-exact-duplicates.xlsx');

    // Scenario 2: Partial Duplicates - Typo in Invoice (20 records)
    console.log("Generating Scenario 2: Partial Duplicates...");
    const scenario2 = [];
    for (let i = 20; i < 40; i++) {
        scenario2.push({
            'Invoice Number': historicalData[i]['Invoice Number'] + 'X', // Typo
            'Vendor ID': historicalData[i]['Vendor ID'],
            'Amount': historicalData[i]['Amount'], // Exact amount points heavily toward duplicate
            'Invoice Date': historicalData[i]['Invoice Date'],
            'Company Code': historicalData[i]['Company Code']
        });
    }
    const wb2 = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb2, xlsx.utils.json_to_sheet(scenario2), 'Scenario 2');
    xlsx.writeFile(wb2, 'test-scenario-2-partial-duplicates.xlsx');

    // Scenario 3: Flagged Due to Similar Amounts & Dates (20 records)
    console.log("Generating Scenario 3: Flagged Similarity...");
    const scenario3 = [];
    for (let i = 40; i < 60; i++) {
        scenario3.push({
            'Invoice Number': historicalData[i]['Invoice Number'] + 'REV',
            'Vendor ID': historicalData[i]['Vendor ID'],
            'Amount': (parseFloat(historicalData[i]['Amount']) + 0.05).toFixed(2), // 5 cents off
            'Invoice Date': historicalData[i]['Invoice Date'],
            'Company Code': historicalData[i]['Company Code']
        });
    }
    const wb3 = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb3, xlsx.utils.json_to_sheet(scenario3), 'Scenario 3');
    xlsx.writeFile(wb3, 'test-scenario-3-flagged-similarity.xlsx');

    // Scenario 4: Completely Clean (20 records)
    console.log("Generating Scenario 4: Clean Records...");
    const scenario4 = [];
    for (let i = 1; i <= 20; i++) {
        scenario4.push({
            'Invoice Number': `INV-NEW-CLEAN-${80000 + i}`,
            'Vendor ID': `V-NEW-${9990 + i}`,
            'Amount': (Math.random() * 5000 + 100).toFixed(2),
            'Invoice Date': new Date(2024, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
            'Company Code': 'CC-001'
        });
    }
    const wb4 = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb4, xlsx.utils.json_to_sheet(scenario4), 'Scenario 4');
    xlsx.writeFile(wb4, 'test-scenario-4-clean.xlsx');

    console.log("All files generated successfully.");
}

try {
    generateData();
} catch (error) {
    console.error("Error generating files:", error);
}
