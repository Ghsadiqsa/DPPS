import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './src/lib/schema';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    const sql = neon(process.env.DATABASE_URL!);
    const db = drizzle(sql, { schema });
    try {
        const [proposal] = await db.insert(schema.paymentProposals).values({
            erpType: "SAP",
            companyCode: "1000",
            status: "VALIDATED"
        }).returning({ id: schema.paymentProposals.id });

        console.log("Proposal inserted:", proposal.id);

        const proposalItemsData = [{
            proposalId: proposal.id,
            vendorCode: "V-UNK",
            vendorId: undefined, // Testing undefined
            invoiceNumber: "INV-1234",
            amount: "0" as any,
            invoiceDate: new Date(),
            currency: "USD",
            lineStatus: "CLEAN",
            matchSummary: {}
        }];

        await db.insert(schema.paymentProposalItems)
            .values(proposalItemsData)
            .onConflictDoNothing({ target: [schema.paymentProposalItems.proposalId, schema.paymentProposalItems.invoiceNumber, schema.paymentProposalItems.vendorCode, schema.paymentProposalItems.amount, schema.paymentProposalItems.invoiceDate] });

        console.log("Proposal items inserted.");
    } catch (e: any) {
        console.error("Error inserting items:", e.message);
    }
}
run();
