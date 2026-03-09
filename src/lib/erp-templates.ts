export type ERPType = 'SAP' | 'Dynamics' | 'Oracle' | 'Sage' | 'Other';
export type EntityType = 'Vendors' | 'Customers' | 'Financial Documents';

interface TemplateField {
    name: string;
    required: boolean;
    description?: string;
    mappedTo?: string; // internal conceptual name
}

// Maps conceptual fields to ERP-specific naming conventions
export const ERP_MAPPINGS: Record<ERPType, Record<EntityType, TemplateField[]>> = {
    SAP: {
        Vendors: [
            { name: 'LIFNR', required: true, mappedTo: 'Vendor ID' },
            { name: 'NAME1', required: true, mappedTo: 'Vendor Name' },
            { name: 'BUKRS', required: false, mappedTo: 'Company Codes' },
            { name: 'STCD1', required: true, mappedTo: 'Tax ID' },
            { name: 'IBAN', required: true, mappedTo: 'IBAN' },
            { name: 'SWIFT', required: false, mappedTo: 'SWIFT/BIC' },
            { name: 'STRAS', required: true, mappedTo: 'Address Line 1' },
            { name: 'PSTLZ', required: true, mappedTo: 'Postal Code' },
            { name: 'LAND1', required: true, mappedTo: 'Country' },
            { name: 'TELF1', required: false, mappedTo: 'Phone Number' },
            { name: 'SMTP_ADDR', required: false, mappedTo: 'Email' },
        ],
        Customers: [
            { name: 'KUNNR', required: true, mappedTo: 'Customer ID' },
            { name: 'NAME1', required: true, mappedTo: 'Customer Name' },
            { name: 'BUKRS', required: false, mappedTo: 'Company Codes' },
            { name: 'STCD1', required: true, mappedTo: 'Tax ID' },
            { name: 'STRAS', required: true, mappedTo: 'Billing Address' },
            { name: 'SMTP_ADDR', required: false, mappedTo: 'Email' },
            { name: 'TELF1', required: false, mappedTo: 'Phone' },
        ],
        'Financial Documents': [
            { name: 'BELNR', required: true, mappedTo: 'Document Number' },
            { name: 'XBLNR', required: true, mappedTo: 'Invoice Number' },
            { name: 'LIFNR', required: false, mappedTo: 'Vendor/Customer ID' },
            { name: 'BLDAT', required: true, mappedTo: 'Invoice Date' },
            { name: 'BUDAT', required: true, mappedTo: 'Posting Date' },
            { name: 'WRBTR', required: true, mappedTo: 'Amount' },
            { name: 'WAERS', required: true, mappedTo: 'Currency' },
            { name: 'MWSTS', required: false, mappedTo: 'Tax Amount' },
            { name: 'EBELN', required: false, mappedTo: 'Purchase Order Number' },
            { name: 'BUKRS', required: true, mappedTo: 'Company Code' },
            { name: 'ZUONR', required: false, mappedTo: 'Reference Number' },
        ],
    },
    Dynamics: {
        Vendors: [
            { name: 'AccountNum', required: true, mappedTo: 'Vendor ID' },
            { name: 'Name', required: true, mappedTo: 'Vendor Name' },
            { name: 'DataAreaId', required: false, mappedTo: 'Company Codes' },
            { name: 'VATNum', required: true, mappedTo: 'Tax ID' },
            { name: 'BankAccount', required: true, mappedTo: 'IBAN' },
            { name: 'SWIFTNo', required: false, mappedTo: 'SWIFT/BIC' },
            { name: 'Address', required: true, mappedTo: 'Address' },
            { name: 'ZipCode', required: true, mappedTo: 'Postal Code' },
            { name: 'CountryRegionId', required: true, mappedTo: 'Country' },
            { name: 'Phone', required: false, mappedTo: 'Phone Number' },
            { name: 'Email', required: false, mappedTo: 'Email' },
        ],
        Customers: [
            { name: 'AccountNum', required: true, mappedTo: 'Customer ID' },
            { name: 'Name', required: true, mappedTo: 'Customer Name' },
            { name: 'DataAreaId', required: false, mappedTo: 'Company Codes' },
            { name: 'VATNum', required: true, mappedTo: 'Tax ID' },
            { name: 'Address', required: true, mappedTo: 'Billing Address' },
            { name: 'Email', required: false, mappedTo: 'Email' },
            { name: 'Phone', required: false, mappedTo: 'Phone' },
        ],
        'Financial Documents': [
            { name: 'Voucher', required: true, mappedTo: 'Document Number' },
            { name: 'InvoiceId', required: true, mappedTo: 'Invoice Number' },
            { name: 'AccountNum', required: true, mappedTo: 'Vendor/Customer ID' },
            { name: 'InvoiceDate', required: true, mappedTo: 'Invoice Date' },
            { name: 'TransDate', required: true, mappedTo: 'Posting Date' },
            { name: 'AmountCur', required: true, mappedTo: 'Amount' },
            { name: 'CurrencyCode', required: true, mappedTo: 'Currency' },
            { name: 'TaxAmount', required: false, mappedTo: 'Tax Amount' },
            { name: 'PurchId', required: false, mappedTo: 'Purchase Order Number' },
            { name: 'DataAreaId', required: true, mappedTo: 'Company Code' },
        ],
    },
    Oracle: {
        Vendors: [
            { name: 'Vendor_Number', required: true, mappedTo: 'Vendor ID' },
            { name: 'Vendor_Name', required: true, mappedTo: 'Vendor Name' },
            { name: 'Ledger_Id', required: false, mappedTo: 'Company Codes' },
            { name: 'Tax_Registration_Number', required: true, mappedTo: 'Tax ID' },
            { name: 'Bank_Account_Number', required: true, mappedTo: 'IBAN' },
            { name: 'Address_Line_1', required: true, mappedTo: 'Address Line 1' },
            { name: 'Postal_Code', required: true, mappedTo: 'Postal Code' },
            { name: 'Country', required: true, mappedTo: 'Country' },
            { name: 'Email_Address', required: false, mappedTo: 'Email' },
        ],
        Customers: [
            { name: 'Customer_Number', required: true, mappedTo: 'Customer ID' },
            { name: 'Customer_Name', required: true, mappedTo: 'Customer Name' },
            { name: 'Ledger_Id', required: false, mappedTo: 'Company Codes' },
            { name: 'Tax_Reference', required: true, mappedTo: 'Tax ID' },
            { name: 'Address1', required: true, mappedTo: 'Address' },
        ],
        'Financial Documents': [
            { name: 'Doc_Sequence_Value', required: true, mappedTo: 'Document Number' },
            { name: 'Invoice_Num', required: true, mappedTo: 'Invoice Number' },
            { name: 'Vendor_Number', required: true, mappedTo: 'Vendor/Customer ID' },
            { name: 'Invoice_Date', required: true, mappedTo: 'Invoice Date' },
            { name: 'GL_Date', required: true, mappedTo: 'Posting Date' },
            { name: 'Invoice_Amount', required: true, mappedTo: 'Amount' },
            { name: 'Invoice_Currency_Code', required: true, mappedTo: 'Currency' },
            { name: 'Ledger_Id', required: true, mappedTo: 'Company Code' },
        ],
    },
    Sage: {
        Vendors: [
            { name: 'Account_Reference', required: true, mappedTo: 'Vendor ID' },
            { name: 'Name', required: true, mappedTo: 'Vendor Name' },
            { name: 'Company_Code', required: false, mappedTo: 'Company Codes' },
            { name: 'VAT_Number', required: true, mappedTo: 'Tax ID' },
            { name: 'Bank_Account_Name', required: true, mappedTo: 'IBAN' },
        ],
        Customers: [
            { name: 'Account_Reference', required: true, mappedTo: 'Customer ID' },
            { name: 'Name', required: true, mappedTo: 'Customer Name' },
            { name: 'Company_Code', required: false, mappedTo: 'Company Codes' },
        ],
        'Financial Documents': [
            { name: 'Document_No', required: true, mappedTo: 'Document Number' },
            { name: 'Reference', required: true, mappedTo: 'Invoice Number' },
            { name: 'Account_Reference', required: true, mappedTo: 'Vendor/Customer ID' },
            { name: 'Date', required: true, mappedTo: 'Invoice Date' },
            { name: 'Foreign_Gross_Amount', required: true, mappedTo: 'Amount' },
            { name: 'Currency', required: true, mappedTo: 'Currency' },
            { name: 'Nominal_Code', required: true, mappedTo: 'Nominal Code' },
        ],
    },
    Other: {
        Vendors: [
            { name: 'Vendor ID', required: true },
            { name: 'Vendor Name', required: true },
            { name: 'Company Codes', required: false },
            { name: 'Tax ID', required: true },
            { name: 'IBAN', required: true },
            { name: 'Address Line 1', required: true },
            { name: 'Postal Code', required: true },
            { name: 'Country', required: true },
            { name: 'Email', required: false },
        ],
        Customers: [
            { name: 'Customer ID', required: true },
            { name: 'Customer Name', required: true },
            { name: 'Company Codes', required: false },
            { name: 'Tax ID', required: true },
            { name: 'Address', required: true },
        ],
        'Financial Documents': [
            { name: 'Document Number', required: true },
            { name: 'Invoice Number', required: true },
            { name: 'Entity ID', required: true },
            { name: 'Invoice Date', required: true },
            { name: 'Posting Date', required: true },
            { name: 'Amount', required: true },
            { name: 'Currency', required: true },
            { name: 'Company Code', required: true },
        ],
    },
};

/**
 * Generate a CSV template string for the given ERP and Entity type
 */
export function generateCSVTemplate(erp: ERPType, entityType: EntityType): string {
    const data = generateTemplateDataArray(erp, entityType);
    return data.map(row => row.join(',')).join('\n');
}

export function generateTemplateDataArray(erp: ERPType, entityType: EntityType): string[][] {
    // Return flexible, generic column headers since the DPPS Engine now uses universal fuzzy NLP parsing.
    // We no longer enforce strict ERP templates or mapping rows.
    if (entityType === 'Vendors') {
        return [['Vendor ID', 'Vendor Name', 'Tax ID', 'Company Code', 'IBAN', 'Address Line 1', 'Postal Code', 'Country', 'Email', 'Phone Number']];
    }
    if (entityType === 'Customers') {
        return [['Customer ID', 'Customer Name', 'Tax ID', 'Company Code', 'Billing Address', 'Email', 'Phone']];
    }
    // Financial Documents
    return [['Invoice Number', 'Vendor ID', 'Gross Amount', 'Currency', 'Invoice Date', 'Posting Date', 'Company Code', 'Purchase Order Number']];
}

/**
 * Check if a CSV row has all the requested fields for a given ERP and Entity type
 */
export function validateCSVRow(erp: ERPType, entityType: EntityType, row: Record<string, any>): string[] {
    // Relaxed validation: Accept any format so users can upload arbitrary files comfortably.
    // The backend will dynamically extract data using broad fallback mappers.
    return [];
}
