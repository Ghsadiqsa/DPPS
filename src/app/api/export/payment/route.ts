import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, vendors } from "@/lib/schema";
import { inArray, eq } from "drizzle-orm";
import { exportHistory } from "@/lib/schema";
import { executeTransition } from "@/lib/transition";
import { auth } from "@/auth";
import * as XLSX from 'xlsx';
import { format } from 'date-fns';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const session = await auth();
        const userId = session?.user?.id || "SYSTEM_EXPORT";

        const { invoiceIds, format: exportFormat } = body;

        if (!Array.isArray(invoiceIds) || invoiceIds.length === 0) {
            return NextResponse.json({ error: "No invoice IDs provided" }, { status: 400 });
        }

        if (!['excel', 'xml', 'json'].includes(exportFormat)) {
            return NextResponse.json({ error: "Invalid export format. Must be excel, xml, or json." }, { status: 400 });
        }

        // Fetch full structured data for the export
        const records = await db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            invoiceDate: invoices.invoiceDate,
            grossAmount: invoices.grossAmount,
            currency: invoices.currency,
            vendorCode: invoices.vendorCode,
            vendorName: vendors.name,
            companyCode: invoices.companyCode,
            poNumber: invoices.poNumber,
            erpType: invoices.erpType,
            lifecycleState: invoices.lifecycleState,
            paymentStatus: invoices.paymentStatus,
        })
            .from(invoices)
            .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
            .where(inArray(invoices.id, invoiceIds));

        if (records.length === 0) {
            return NextResponse.json({ error: "No records found matching those IDs" }, { status: 404 });
        }

        // Transition logic and Audit History
        const transitionPromises = records.map(async (r) => {
            try {
                if (r.lifecycleState !== "RELEASED_TO_PAYMENT" && r.lifecycleState !== "PAID") {
                    await executeTransition({
                        invoiceId: r.id,
                        toState: "RELEASED_TO_PAYMENT",
                        actorUserId: userId,
                        reasonCode: "ERP_PAYMENT_RELEASE",
                        notes: `Exported to ${exportFormat} format`
                    });
                }

                await db.insert(exportHistory).values({
                    invoiceId: r.id,
                    createdBy: session?.user?.id || null, // null if anonymous
                    exportType: exportFormat,
                });
            } catch (err) {
                console.warn(`Failed transitioning ${r.id}:`, err);
            }
        });

        await Promise.allSettled(transitionPromises);

        // Generate XML
        if (exportFormat === 'xml') {
            let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<PaymentLoad>\n`;
            xml += `  <Header>\n`;
            xml += `    <CreationDate>${new Date().toISOString()}</CreationDate>\n`;
            xml += `    <RecordCount>${records.length}</RecordCount>\n`;
            xml += `  </Header>\n`;
            xml += `  <Invoices>\n`;

            for (const r of records) {
                xml += `    <Invoice>\n`;
                xml += `      <InvoiceNumber>${escapeXml(r.invoiceNumber)}</InvoiceNumber>\n`;
                xml += `      <VendorCode>${escapeXml(r.vendorCode)}</VendorCode>\n`;
                xml += `      <VendorName>${escapeXml(r.vendorName)}</VendorName>\n`;
                xml += `      <GrossAmount>${r.grossAmount}</GrossAmount>\n`;
                xml += `      <Currency>${r.currency}</Currency>\n`;
                xml += `      <InvoiceDate>${r.invoiceDate ? format(new Date(r.invoiceDate), 'yyyy-MM-dd') : ''}</InvoiceDate>\n`;
                xml += `      <CompanyCode>${escapeXml(r.companyCode)}</CompanyCode>\n`;
                xml += `      <PONumber>${escapeXml(r.poNumber)}</PONumber>\n`;
                xml += `      <ERPType>${escapeXml(r.erpType)}</ERPType>\n`;
                xml += `    </Invoice>\n`;
            }

            xml += `  </Invoices>\n</PaymentLoad>\n`;

            return new NextResponse(xml, {
                status: 200,
                headers: {
                    'Content-Type': 'application/xml',
                    'Content-Disposition': `attachment; filename="DPPS_Payment_Load_${format(new Date(), 'yyyyMMdd_HHmm')}.xml"`,
                },
            });
        }

        // Generate JSON
        if (exportFormat === 'json') {
            const payload = {
                metadata: {
                    generatedAt: new Date().toISOString(),
                    recordCount: records.length,
                    system: 'DPPS Financial Control Tower',
                },
                invoices: records.map(r => ({
                    invoiceNumber: r.invoiceNumber,
                    vendorCode: r.vendorCode,
                    vendorName: r.vendorName,
                    grossAmount: Number(r.grossAmount),
                    currency: r.currency,
                    invoiceDate: r.invoiceDate ? format(new Date(r.invoiceDate), 'yyyy-MM-dd') : null,
                    companyCode: r.companyCode,
                    poNumber: r.poNumber,
                    erpType: r.erpType,
                }))
            };

            return new NextResponse(JSON.stringify(payload, null, 2), {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Disposition': `attachment; filename="DPPS_Payment_Load_${format(new Date(), 'yyyyMMdd_HHmm')}.json"`,
                },
            });
        }

        // Generate Excel (we return base64 and decode on client since fetch() handles blobs weirdly sometimes)
        if (exportFormat === 'excel') {
            const rows = records.map(r => ({
                "ERP Source": r.erpType === 'GENERIC' ? 'N/A' : r.erpType,
                "Company Code": r.companyCode,
                "Vendor Code": r.vendorCode,
                "Vendor Name": r.vendorName,
                "Invoice Number": r.invoiceNumber,
                "Invoice Date": r.invoiceDate ? format(new Date(r.invoiceDate), 'MM/dd/yyyy') : '',
                "Gross Amount": Number(r.grossAmount),
                "Currency": r.currency,
                "PO Number": r.poNumber || '',
                "Validation Status": "CLEARED BY DPPS",
            }));

            const ws = XLSX.utils.json_to_sheet(rows);
            // Auto-size columns roughly
            const colWidths = [
                { wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 30 }, { wch: 20 },
                { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 15 }, { wch: 20 }
            ];
            ws['!cols'] = colWidths;

            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Payment_Load");

            // Write to base64
            const b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

            return NextResponse.json({
                filename: `DPPS_Payment_Load_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`,
                data: b64,
                type: 'base64'
            });
        }

    } catch (error: any) {
        console.error("Export generation error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

function escapeXml(unsafe: string | null | undefined) {
    if (!unsafe) return '';
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
            default: return c;
        }
    });
}
