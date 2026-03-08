import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
    try {
        const { detectDuplicates } = await import('./src/lib/detection');
        const results = await detectDuplicates([{
            vendorCode: "V-UNK",
            invoiceNumber: "INV-123",
            amount: 100,
            invoiceDate: new Date().toISOString(),
            currency: "USD",
            companyCode: "1000"
        }]);
        console.log("Detection results:", JSON.stringify(results, null, 2));
    } catch (e: any) {
        console.error("Detection Error Stack:", e.stack);
    }
}
run();
