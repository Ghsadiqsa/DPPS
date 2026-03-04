/**
 * DPPS Invoice Detection Demo Seed Script
 * 
 * Seeds vendors + a realistic payment proposal with invoices that produce:
 * - CLEAN (score < 70)          → 2 invoices
 * - POTENTIAL_DUPLICATE (70-94) → 2 invoices
 * - BLOCKED (≥ 95)              → 1 invoice (exact duplicate / composite key match)
 *
 * Run: npx ts-node --project tsconfig.node.json scripts/seed-detection-demo.ts
 */

import { db } from '../src/lib/db';
import { vendors, invoices } from '../src/lib/schema';
import { sql } from 'drizzle-orm';

const VENDOR_A_ID = 'demo-vendor-acme-001';
const VENDOR_B_ID = 'demo-vendor-globex-002';

async function seedDemo() {
    console.log('🌱 Seeding invoice detection demo data...\n');

    // 1. Upsert vendors
    await db.insert(vendors).values([
        {
            id: VENDOR_A_ID,
            vendorCode: 'ACME-001',
            name: 'Acme Corporation Ltd',
            country: 'US',
            currency: 'USD',
            erpType: 'SAP',
            companyCode: 'CC01',
            iban: 'GB29NWBK60161331926819',
            swiftBic: 'NWBKGB2L',
            isActive: true,
        },
        {
            id: VENDOR_B_ID,
            vendorCode: 'GLOBEX-002',
            name: 'Globex International Inc',
            country: 'US',
            currency: 'USD',
            erpType: 'SAP',
            companyCode: 'CC01',
            iban: 'GB94BARC10201530093459',
            swiftBic: 'BARCGB22',
            isActive: true,
        },
    ]).onConflictDoNothing();

    console.log('✅ Vendors seeded');

    // 2. Seed a base invoice (already in system - historical record)
    await db.insert(invoices).values([
        {
            vendorId: VENDOR_A_ID,
            vendorCode: 'ACME-001',
            invoiceNumber: 'ACME-2025-001',
            grossAmount: '15000.00',
            currency: 'USD',
            invoiceDate: new Date('2025-01-15'),
            dueDate: new Date('2025-02-14'),
            companyCode: 'CC01',
            poNumber: 'PO-88001',
            referenceNumber: 'REF-88001',
            erpType: 'SAP',
            lifecycleState: 'PAID',
            riskScore: 10,
            riskBand: 'low',
            paymentStatus: 'COMPLETED',
            paymentDate: new Date('2025-02-10'),
        },
        {
            vendorId: VENDOR_B_ID,
            vendorCode: 'GLOBEX-002',
            invoiceNumber: 'GLX-2025-0077',
            grossAmount: '42000.00',
            currency: 'USD',
            invoiceDate: new Date('2025-03-01'),
            dueDate: new Date('2025-03-31'),
            companyCode: 'CC01',
            poNumber: 'PO-99201',
            referenceNumber: 'REF-99201',
            erpType: 'SAP',
            lifecycleState: 'PAID',
            riskScore: 8,
            riskBand: 'low',
            paymentStatus: 'COMPLETED',
            paymentDate: new Date('2025-03-25'),
        },
    ]).onConflictDoNothing();

    console.log('✅ Historical (PAID) invoices seeded\n');

    // 3. Seed new proposal invoices that will trigger detection outcomes
    // These are "PROPOSAL" state — they will be validated via Payment Gate
    const demoProposals = [
        // --- CLEAN: Different vendor, different amount, different inv# ---
        {
            vendorId: VENDOR_B_ID,
            vendorCode: 'GLOBEX-002',
            invoiceNumber: 'GLX-2025-0099',
            grossAmount: '8750.00',
            currency: 'USD',
            invoiceDate: new Date('2025-11-10'),
            dueDate: new Date('2025-12-10'),
            companyCode: 'CC01',
            poNumber: 'PO-11001',
            referenceNumber: 'REF-11001',
            erpType: 'SAP',
            lifecycleState: 'PROPOSAL',
            riskScore: null,
            riskBand: null,
            paymentStatus: 'PENDING',
        },
        // --- CLEAN: Another clean invoice ---
        {
            vendorId: VENDOR_B_ID,
            vendorCode: 'GLOBEX-002',
            invoiceNumber: 'GLX-2025-0200',
            grossAmount: '3200.00',
            currency: 'USD',
            invoiceDate: new Date('2025-12-01'),
            dueDate: new Date('2026-01-01'),
            companyCode: 'CC01',
            poNumber: 'PO-11002',
            referenceNumber: 'REF-11002',
            erpType: 'SAP',
            lifecycleState: 'PROPOSAL',
            riskScore: null,
            riskBand: null,
            paymentStatus: 'PENDING',
        },
        // --- POTENTIAL_DUPLICATE: Same vendor as ACME, same amount, similar inv# (within 7 days) ---
        // Matches score ~70-80: exact amount (40) + vendor (30) + fuzzy inv pattern = ~75
        {
            vendorId: VENDOR_A_ID,
            vendorCode: 'ACME-001',
            invoiceNumber: 'ACME-2025-002',   // similar to ACME-2025-001 → ~92% Levenshtein
            grossAmount: '15000.00',          // exact amount match
            currency: 'USD',
            invoiceDate: new Date('2025-01-18'), // 3 days from Jan 15
            dueDate: new Date('2025-02-18'),
            companyCode: 'CC01',
            poNumber: 'PO-88002',
            referenceNumber: 'REF-88099',   // different ref = no composite key
            erpType: 'SAP',
            lifecycleState: 'POTENTIAL_DUPLICATE',
            riskScore: 75,
            riskBand: 'high',
            paymentStatus: 'PENDING',
        },
        // --- POTENTIAL_DUPLICATE: Fuzzy amount match ---
        {
            vendorId: VENDOR_A_ID,
            vendorCode: 'ACME-001',
            invoiceNumber: 'ACME-2025-00l', // OCR: lowercase L instead of 1
            grossAmount: '15001.00',        // fuzzy amount within 0.5%
            currency: 'USD',
            invoiceDate: new Date('2025-01-16'),
            dueDate: new Date('2025-02-15'),
            companyCode: 'CC01',
            poNumber: 'PO-88003',
            referenceNumber: 'REF-88003',
            erpType: 'SAP',
            lifecycleState: 'POTENTIAL_DUPLICATE',
            riskScore: 72,
            riskBand: 'high',
            paymentStatus: 'PENDING',
        },
        // --- BLOCKED: Exact duplicate (same vendor, same amount, same ref = composite key match → score ≥ 95) ---
        {
            vendorId: VENDOR_A_ID,
            vendorCode: 'ACME-001',
            invoiceNumber: 'ACME-2025-001',  // exact same invoice number
            grossAmount: '15000.00',          // exact same amount
            currency: 'USD',
            invoiceDate: new Date('2025-01-15'),
            dueDate: new Date('2025-02-14'),
            companyCode: 'CC01',
            poNumber: 'PO-88001',
            referenceNumber: 'REF-88001',    // same ref = composite key match → +50 boost → score = 100
            erpType: 'SAP',
            lifecycleState: 'BLOCKED',
            riskScore: 100,
            riskBand: 'critical',
            paymentStatus: 'PENDING',
        },
    ];

    await db.insert(invoices).values(demoProposals as any[]).onConflictDoNothing();

    console.log('✅ Demo proposal invoices seeded:\n');
    console.log('  2x PROPOSAL  (CLEAN)               → will score < 70');
    console.log('  2x POTENTIAL_DUPLICATE              → score 70-84 (same vendor+amount+similar inv#)');
    console.log('  1x BLOCKED                          → score 100 (exact duplicate, composite key match)');
    console.log('\n📊 Navigate to:');
    console.log('  /gate           → Upload proposal XML/CSV to trigger live detection');
    console.log('  /pre-pay        → Review POTENTIAL_DUPLICATE queue');
    console.log('  /               → Dashboard metrics updated');
    console.log('\n🎬 Demo data is ready for recording!');

    process.exit(0);
}

seedDemo().catch(e => { console.error('Seed failed:', e); process.exit(1); });
