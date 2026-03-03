import "dotenv/config";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { db } from '../src/lib/db';
import { vendors, invoices, cases } from '../src/lib/schema';
import { sql } from 'drizzle-orm';

const VENDOR_NAMES = [
    "Acme Corp", "Globex", "Soylent", "Initech", "Umbrella Corp",
    "Wayne Enterprises", "Stark Industries", "Massive Dynamic",
    "Cyberdyne Systems", "Hooli"
];

async function main() {
    console.log("Starting DB Seed...");

    // Clear existing
    await db.execute(sql`TRUNCATE TABLE invoices, cases, vendors CASCADE`);

    // Create Vendors
    console.log("Creating vendors...");
    const vendorIds: { id: string, code: string }[] = [];
    for (let i = 0; i < 10; i++) {
        const vCode = `VEND-${1000 + i}`;
        const [inserted] = await db.insert(vendors).values({
            vendorCode: vCode,
            erpType: "SAP",
            companyCode: "1000",
            name: VENDOR_NAMES[i],
            taxId: `TAX-${1000 + i}`,
            iban: `IBAN${i}XYZ`,
            addressLine1: `123 ${VENDOR_NAMES[i]} St`,
            country: "USA",
            totalSpend: String(100000 + (Math.random() * 900000)),
            duplicateCount: Math.floor(Math.random() * 20),
            riskLevel: i < 3 ? "high" : i < 6 ? "medium" : "low"
        }).returning({ id: vendors.id, vendorCode: vendors.vendorCode });
        vendorIds.push({ id: inserted.id, code: inserted.vendorCode! });
    }

    const scenarios = [
        { name: "Exact Match", count: 30, scoreRange: [100, 100], isDup: true, lifecycle: 'BLOCKED' },
        { name: "Fuzzy Match", count: 30, scoreRange: [80, 95], isDup: true, lifecycle: 'POTENTIAL_DUPLICATE' },
        { name: "OCR Error", count: 30, scoreRange: [85, 98], isDup: true, lifecycle: 'POTENTIAL_DUPLICATE' },
        { name: "Pattern Match", count: 30, scoreRange: [75, 85], isDup: true, lifecycle: 'POTENTIAL_DUPLICATE' },
        { name: "Legitimate", count: 200, scoreRange: [0, 20], isDup: false, lifecycle: 'PAID' }
    ];

    console.log("Creating invoices...");
    let invoiceIdCounter = 10000;
    for (const scenario of scenarios) {
        for (let i = 0; i < scenario.count; i++) {
            const vendor = vendorIds[Math.floor(Math.random() * vendorIds.length)];
            const amountValue = (1000 + (Math.random() * 50000)).toFixed(2);
            const score = Math.floor(Math.random() * (scenario.scoreRange[1] - scenario.scoreRange[0] + 1)) + scenario.scoreRange[0];

            // Random date within the last 30 days
            const daysAgo = Math.floor(Math.random() * 30);
            const invoiceDate = new Date();
            invoiceDate.setDate(invoiceDate.getDate() - daysAgo);

            await db.insert(invoices).values({
                erpType: "SAP",
                companyCode: "1000",
                vendorCode: vendor.code,
                invoiceNumber: `INV-${invoiceIdCounter++}`,
                vendorId: vendor.id,
                amount: amountValue,
                grossAmount: amountValue,
                invoiceDate,
                lifecycleState: scenario.lifecycle as any,
                status: scenario.lifecycle, // legacy
                riskScore: score,
                riskBand: score >= 85 ? "HIGH" : score >= 70 ? "MEDIUM" : "LOW",
                isDuplicate: scenario.isDup,
                signals: scenario.isDup ? [JSON.stringify({ name: scenario.name, triggered: true })] : [],
                createdAt: invoiceDate
            });
        }
    }

    console.log("Seeding complete.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
