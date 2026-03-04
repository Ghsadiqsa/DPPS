import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { vendors, invoices } from '@/lib/schema';

// POST /api/demo-seed — seeds vendors + demo invoices at all lifecycle states
export async function POST() {
    try {
        const VENDOR_A_ID = 'demo-vendor-acme-001';
        const VENDOR_B_ID = 'demo-vendor-globex-002';

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
            } as any,
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
            } as any,
        ] as any[]).onConflictDoNothing();

        // 2. Historical PAID invoices (already processed — the baseline)
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
        ] as any[]).onConflictDoNothing();

        // 3. Proposal invoices at each detection outcome state
        await db.insert(invoices).values([
            // CLEAN — different vendor, different amount, different inv#
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
                lifecycleState: 'CLEARED',
                riskScore: 12,
                riskBand: 'low',
                paymentStatus: 'PENDING',
            },
            // CLEAN 2
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
                lifecycleState: 'CLEARED',
                riskScore: 9,
                riskBand: 'low',
                paymentStatus: 'PENDING',
            },
            // POTENTIAL DUPLICATE — same vendor + exact amount + similar inv# (score ~75)
            {
                vendorId: VENDOR_A_ID,
                vendorCode: 'ACME-001',
                invoiceNumber: 'ACME-2025-002',
                grossAmount: '15000.00',
                currency: 'USD',
                invoiceDate: new Date('2025-01-18'),
                dueDate: new Date('2025-02-18'),
                companyCode: 'CC01',
                poNumber: 'PO-88002',
                referenceNumber: 'REF-88099',
                erpType: 'SAP',
                lifecycleState: 'POTENTIAL_DUPLICATE',
                riskScore: 75,
                riskBand: 'high',
                paymentStatus: 'PENDING',
            },
            // POTENTIAL DUPLICATE — OCR error on inv# (score ~72)
            {
                vendorId: VENDOR_A_ID,
                vendorCode: 'ACME-001',
                invoiceNumber: 'ACME-2025-00I',
                grossAmount: '15001.00',
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
            // BLOCKED — exact duplicate with composite key match (score 100)
            {
                vendorId: VENDOR_A_ID,
                vendorCode: 'ACME-001',
                invoiceNumber: 'ACME-2025-001-DUP',
                grossAmount: '15000.00',
                currency: 'USD',
                invoiceDate: new Date('2025-01-15'),
                dueDate: new Date('2025-02-14'),
                companyCode: 'CC01',
                poNumber: 'PO-88001',
                referenceNumber: 'REF-88001',
                erpType: 'SAP',
                lifecycleState: 'BLOCKED',
                riskScore: 100,
                riskBand: 'critical',
                paymentStatus: 'PENDING',
            },
            // RECOVERY — paid duplicate discovered post-payment
            {
                vendorId: VENDOR_B_ID,
                vendorCode: 'GLOBEX-002',
                invoiceNumber: 'GLX-2025-0077-R',
                grossAmount: '42000.00',
                currency: 'USD',
                invoiceDate: new Date('2025-03-01'),
                dueDate: new Date('2025-03-31'),
                companyCode: 'CC01',
                poNumber: 'PO-99201',
                referenceNumber: 'REF-99201',
                erpType: 'SAP',
                lifecycleState: 'RECOVERY',
                riskScore: 95,
                riskBand: 'critical',
                paymentStatus: 'COMPLETED',
                paymentDate: new Date('2025-03-25'),
            },
        ] as any[]).onConflictDoNothing();

        return NextResponse.json({
            success: true,
            message: 'Demo data seeded successfully',
            seeded: {
                vendors: 2,
                historical_paid: 2,
                cleared: 2,
                potential_duplicates: 2,
                blocked: 1,
                recovery: 1,
            }
        });
    } catch (error: any) {
        console.error('Demo seed error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// DELETE /api/demo-seed — cleanup demo data
export async function DELETE() {
    try {
        const { eq, or, like } = await import('drizzle-orm');
        await db.delete(invoices).where(
            or(
                like(invoices.vendorCode, 'ACME-%'),
                like(invoices.vendorCode, 'GLOBEX-%')
            )
        );
        await db.delete(vendors).where(
            or(
                eq(vendors.id, 'demo-vendor-acme-001'),
                eq(vendors.id, 'demo-vendor-globex-002')
            )
        );
        return NextResponse.json({ success: true, message: 'Demo data cleaned up' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
