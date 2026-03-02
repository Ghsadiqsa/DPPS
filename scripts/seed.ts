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
    const vendorIds: string[] = [];
    for (let i = 0; i < 10; i++) {
        const [inserted] = await db.insert(vendors).values({
            name: VENDOR_NAMES[i],
            taxId: `TAX-${1000 + i}`,
            iban: `IBAN${i}XYZ`,
            addressLine1: `123 ${VENDOR_NAMES[i]} St`,
            country: "USA",
            totalSpend: String(100000 + (Math.random() * 900000)),
            duplicateCount: Math.floor(Math.random() * 20),
            riskLevel: i < 3 ? "high" : i < 6 ? "medium" : "low"
        }).returning({ id: vendors.id });
        vendorIds.push(inserted.id);
    }

    const scenarios = [
        { name: "Exact Match", count: 30, scoreRange: [100, 100], isDup: true, status: 'held' },
        { name: "Fuzzy Match", count: 30, scoreRange: [80, 95], isDup: true, status: 'held' },
        { name: "OCR Error", count: 30, scoreRange: [85, 98], isDup: true, status: 'held' },
        { name: "Pattern Match", count: 30, scoreRange: [75, 85], isDup: true, status: 'held' },
        { name: "Legitimate", count: 200, scoreRange: [0, 20], isDup: false, status: 'approved' }
    ];

    console.log("Creating invoices...");
    let invoiceIdCounter = 10000;
    for (const scenario of scenarios) {
        for (let i = 0; i < scenario.count; i++) {
            const vendorId = vendorIds[Math.floor(Math.random() * vendorIds.length)];
            const amount = (1000 + (Math.random() * 50000)).toFixed(2);
            const score = Math.floor(Math.random() * (scenario.scoreRange[1] - scenario.scoreRange[0] + 1)) + scenario.scoreRange[0];

            // Random date within the last 30 days
            const daysAgo = Math.floor(Math.random() * 30);
            const invoiceDate = new Date();
            invoiceDate.setDate(invoiceDate.getDate() - daysAgo);

            await db.insert(invoices).values({
                invoiceNumber: `INV-${invoiceIdCounter++}`,
                vendorId,
                amount: amount,
                invoiceDate,
                status: scenario.status,
                similarityScore: score,
                isDuplicate: scenario.isDup,
                signals: scenario.isDup ? [scenario.name] : [],
                createdAt: invoiceDate // Using same generated date for created_at to spread across the timeline
            });
        }
    }

    console.log("Seeding complete.");
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
