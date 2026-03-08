import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { dppsConfig } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_CONFIG } from '@/lib/duplicate-detection';

const CONFIG_ID = 'default';

// GET /api/config - Get current DPPS configuration
export async function GET() {
    try {
        const configs = await db.select().from(dppsConfig).where(eq(dppsConfig.id, CONFIG_ID));

        if (configs.length === 0) {
            // Return default config if none exists
            return NextResponse.json({
                id: CONFIG_ID,
                criticalThreshold: DEFAULT_CONFIG.criticalThreshold,
                highThreshold: DEFAULT_CONFIG.highThreshold,
                mediumThreshold: DEFAULT_CONFIG.mediumThreshold,
                invoicePatternTrigger: Math.round(DEFAULT_CONFIG.invoicePatternTrigger * 100),
                dateProximityDays: DEFAULT_CONFIG.dateProximityDays,
                fuzzyAmountTolerance: (DEFAULT_CONFIG.fuzzyAmountTolerance * 100).toFixed(1),
                legalEntityScope: DEFAULT_CONFIG.legalEntityScope,
            });
        }

        return NextResponse.json(configs[0]);
    } catch (error) {
        console.error('Error fetching config:', error);
        return NextResponse.json(
            { error: 'Failed to fetch configuration' },
            { status: 500 }
        );
    }
}

// PATCH /api/config - Update DPPS configuration
export async function PATCH(request: NextRequest) {
    try {
        const updates = await request.json();

        // Check if config exists
        const existing = await db.select().from(dppsConfig).where(eq(dppsConfig.id, CONFIG_ID));

        if (existing.length === 0) {
            // Create new config with defaults and updates
            const newConfig = await db.insert(dppsConfig).values({
                id: CONFIG_ID,
                ...updates,
                updatedAt: new Date(),
            }).returning();

            return NextResponse.json(newConfig[0]);
        }

        // Update existing config
        const updated = await db.update(dppsConfig)
            .set({
                ...updates,
                updatedAt: new Date(),
            })
            .where(eq(dppsConfig.id, CONFIG_ID))
            .returning();

        return NextResponse.json(updated[0]);
    } catch (error) {
        console.error('Error updating config:', error);
        return NextResponse.json(
            { error: 'Failed to update configuration' },
            { status: 500 }
        );
    }
}

// POST /api/config/reset - Reset configuration to defaults
export async function POST() {
    try {
        const existing = await db.select().from(dppsConfig).where(eq(dppsConfig.id, CONFIG_ID));

        const defaultValues = {
            criticalThreshold: "0.85",
            highThreshold: "0.70",
            mediumThreshold: "0.50",
            invoicePatternTrigger: "0.80",
            dateProximityDays: 7,
            fuzzyAmountTolerance: "0.005",
            legalEntityScope: "within",
            updatedAt: new Date(),
        };

        if (existing.length === 0) {
            const newConfig = await db.insert(dppsConfig).values({
                id: CONFIG_ID,
                ...defaultValues,
            }).returning();

            return NextResponse.json(newConfig[0]);
        }

        const updated = await db.update(dppsConfig)
            .set(defaultValues)
            .where(eq(dppsConfig.id, CONFIG_ID))
            .returning();

        return NextResponse.json(updated[0]);
    } catch (error) {
        console.error('Error resetting config:', error);
        return NextResponse.json(
            { error: 'Failed to reset configuration' },
            { status: 500 }
        );
    }
}
