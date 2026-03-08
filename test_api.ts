import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './src/lib/schema';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    try {
        const sql = neon(process.env.DATABASE_URL!);
        const db = drizzle(sql, { schema });

        const { detectDuplicates } = await import('./src/lib/detection');
        const detectionItems = [{
            vendorCode: "V-UNK",
            invoiceNumber: "INV-6002",
            amount: 50.25,
            invoiceDate: new Date().toISOString(),
            currency: "USD",
            companyCode: "1000"
        }];

        const enrichedItems = await detectDuplicates(detectionItems);

        const [proposal] = await db.insert(schema.paymentProposals).values({
            erpType: "SAP",
            companyCode: "1000",
            status: "VALIDATED"
        }).returning({ id: schema.paymentProposals.id });

        console.log("Proposal inserted:", proposal.id);

        const proposalItemsData = enrichedItems.map((item: any) => ({
            proposalId: proposal.id,
            vendorCode: item.vendorCode,
            vendorId: item.vendorId,
            invoiceNumber: item.invoiceNumber,
            amount: String(item.amount),
            invoiceDate: new Date(item.invoiceDate),
            currency: item.currency,
            lineStatus: item.lineStatus,
            matchSummary: item.matchSummary
        }));

        if (proposalItemsData.length > 0) {
            await db.insert(schema.paymentProposalItems)
                .values(proposalItemsData as any)
                .onConflictDoNothing();
        }

        console.log("End-to-End Success!");

    } catch (e: any) {
        console.error("Simulation API Error Stack:", e.stack);
    }
}
run();
