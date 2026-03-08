import {
    users,
    vendors,
    cases,
    invoices,
    recoveryItems,
    caseActivities,
    financialDocuments,
    customers,
    type User,
    type InsertUser,
    type Vendor,
    type InsertVendor,
    type Customer,
    type FinancialDocument,
    type Case,
    type InsertCase,
    type Invoice,
    type InsertInvoice,
    type RecoveryItem,
    type InsertRecoveryItem,
    type CaseActivity,
    type InsertCaseActivity,
} from "./schema";
import { db } from "./db";
import { eq, desc, and, sql, inArray } from "drizzle-orm";

export interface IStorage {
    // User operations
    getUser(id: string): Promise<User | undefined>;
    getUserByUsername(username: string): Promise<User | undefined>;
    createUser(user: InsertUser): Promise<User>;

    // Vendor operations
    getVendor(id: string): Promise<Vendor | undefined>;
    getVendorByName(name: string): Promise<Vendor | undefined>;
    getAllVendors(): Promise<Vendor[]>;
    getRecentVendors(limit?: number): Promise<Vendor[]>;
    getRecentCustomers(limit?: number): Promise<Customer[]>;
    getRecentFinancialDocuments(limit?: number): Promise<FinancialDocument[]>;
    createVendor(vendor: InsertVendor): Promise<Vendor>;
    updateVendor(id: string, updates: Partial<InsertVendor>): Promise<Vendor | undefined>;

    // Case operations
    getCase(id: string): Promise<Case | undefined>;
    getCaseByCaseNumber(caseNumber: string): Promise<Case | undefined>;
    getAllCases(): Promise<Case[]>;
    getCasesByStatus(status: string): Promise<Case[]>;
    createCase(caseData: InsertCase): Promise<Case>;
    updateCase(id: string, updates: Partial<InsertCase>): Promise<Case | undefined>;

    // Invoice operations
    getInvoice(id: string): Promise<Invoice | undefined>;
    getInvoicesByCase(caseId: string): Promise<Invoice[]>;
    getAllInvoices(): Promise<Invoice[]>;
    findDuplicateInvoices(invoiceNumber: string, vendorId: string, amount: string): Promise<Invoice[]>;
    createInvoice(invoice: InsertInvoice): Promise<Invoice>;
    updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined>;

    // Recovery operations
    getRecoveryItem(id: string): Promise<RecoveryItem | undefined>;
    getAllRecoveryItems(): Promise<RecoveryItem[]>;
    getRecoveryItemsByStatus(status: string): Promise<RecoveryItem[]>;
    createRecoveryItem(item: InsertRecoveryItem): Promise<RecoveryItem>;
    updateRecoveryItem(id: string, updates: Partial<InsertRecoveryItem>): Promise<RecoveryItem | undefined>;

    // Case activity operations
    getCaseActivities(caseId: string): Promise<CaseActivity[]>;
    createCaseActivity(activity: InsertCaseActivity): Promise<CaseActivity>;

    // Dashboard analytics
    getDashboardMetrics(): Promise<{
        totalSavings: number;
        activeCases: number;
        recoveryInProgress: number;
        duplicatesDetected: number;
    }>;
}

export class DatabaseStorage implements IStorage {
    // User operations
    async getUser(id: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user || undefined;
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user || undefined;
    }

    async createUser(insertUser: InsertUser): Promise<User> {
        const [user] = await db.insert(users).values(insertUser).returning();
        return user;
    }

    // Vendor operations
    async getVendor(id: string): Promise<Vendor | undefined> {
        const [vendor] = await db.select().from(vendors).where(eq(vendors.id, id));
        return vendor || undefined;
    }

    async getVendorByName(name: string): Promise<Vendor | undefined> {
        const [vendor] = await db.select().from(vendors).where(eq(vendors.name, name));
        return vendor || undefined;
    }

    async getAllVendors(): Promise<Vendor[]> {
        return await db.select().from(vendors).orderBy(desc(vendors.totalSpend));
    }

    async getRecentVendors(limitVal = 50): Promise<Vendor[]> {
        return await db.select().from(vendors).orderBy(desc(vendors.createdAt)).limit(limitVal);
    }

    async getRecentCustomers(limitVal = 50): Promise<Customer[]> {
        return await db.select().from(customers).orderBy(desc(customers.createdAt)).limit(limitVal);
    }

    async getRecentFinancialDocuments(limitVal = 50): Promise<FinancialDocument[]> {
        return await db.select().from(financialDocuments).orderBy(desc(financialDocuments.createdAt)).limit(limitVal);
    }

    async createVendor(vendor: InsertVendor): Promise<Vendor> {
        const [newVendor] = await db.insert(vendors).values(vendor).returning();
        return newVendor;
    }

    async updateVendor(id: string, updates: Partial<InsertVendor>): Promise<Vendor | undefined> {
        const [updated] = await db.update(vendors).set(updates).where(eq(vendors.id, id)).returning();
        return updated || undefined;
    }

    // Case operations
    async getCase(id: string): Promise<Case | undefined> {
        const [caseRecord] = await db.select().from(cases).where(eq(cases.id, id));
        return caseRecord || undefined;
    }

    async getCaseByCaseNumber(caseNumber: string): Promise<Case | undefined> {
        const [caseRecord] = await db.select().from(cases).where(eq(cases.id, caseNumber));
        return caseRecord || undefined;
    }

    async getAllCases(): Promise<Case[]> {
        return await db.select().from(cases).orderBy(desc(cases.createdAt));
    }

    async getCasesByStatus(status: string): Promise<Case[]> {
        return await db.select().from(cases).where(eq(cases.status, status)).orderBy(desc(cases.createdAt));
    }

    async createCase(caseData: InsertCase): Promise<Case> {
        const [newCase] = await db.insert(cases).values(caseData).returning();
        return newCase;
    }

    async updateCase(id: string, updates: Partial<InsertCase>): Promise<Case | undefined> {
        const [updated] = await db.update(cases).set({ ...updates, updatedAt: new Date() }).where(eq(cases.id, id)).returning();
        return updated || undefined;
    }

    // Invoice operations
    async getInvoice(id: string): Promise<Invoice | undefined> {
        const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
        return invoice || undefined;
    }

    async getInvoicesByCase(caseId: string): Promise<Invoice[]> {
        return await db.select().from(invoices).where(eq(invoices.duplicateGroupId, caseId));
    }

    async getAllInvoices(): Promise<Invoice[]> {
        return await db.select().from(invoices).orderBy(desc(invoices.createdAt));
    }

    async findDuplicateInvoices(invoiceNumber: string, vendorId: string, amount: string): Promise<Invoice[]> {
        // If no identifying info, return empty
        if (!invoiceNumber && !vendorId) return [];

        // Ground truth for duplicates is the historical dataset (financialDocuments). 
        // We fetch candidates that match at least one identifying field to allow for fuzzy matching in JS.
        const docs = await db.select().from(financialDocuments).where(
            sql`${financialDocuments.vendorId} = ${vendorId} OR ${financialDocuments.invoiceNumber} = ${invoiceNumber}`
        ).limit(100); // Limit to avoid massive payloads, detectDuplicate will find the best ones.

        return docs.map(d => ({
            id: d.id,
            invoiceNumber: d.invoiceNumber,
            vendorId: d.vendorId!,
            amount: d.amount,
            invoiceDate: d.invoiceDate,
            companyCode: d.companyCode,
            referenceNumber: d.referenceNumber,
            caseId: null,
            docId: d.documentNumber,
            lifecycleState: "INGESTED",
            similarityScore: null,
            signals: null,
            createdAt: d.createdAt,
        } as unknown as Invoice));
    }

    async createInvoice(invoice: InsertInvoice): Promise<Invoice> {
        const [newInvoice] = await db.insert(invoices).values(invoice).returning();
        return newInvoice;
    }

    async updateInvoice(id: string, updates: Partial<InsertInvoice>): Promise<Invoice | undefined> {
        const [updated] = await db.update(invoices).set(updates).where(eq(invoices.id, id)).returning();
        return updated || undefined;
    }

    // Recovery operations
    async getRecoveryItem(id: string): Promise<RecoveryItem | undefined> {
        const [item] = await db.select().from(recoveryItems).where(eq(recoveryItems.id, id));
        return item || undefined;
    }

    async getAllRecoveryItems(): Promise<RecoveryItem[]> {
        return await db.select().from(recoveryItems).orderBy(desc(recoveryItems.initiatedDate));
    }

    async getRecoveryItemsByStatus(status: string): Promise<RecoveryItem[]> {
        return await db.select().from(recoveryItems).where(eq(recoveryItems.status, status)).orderBy(desc(recoveryItems.initiatedDate));
    }

    async createRecoveryItem(item: InsertRecoveryItem): Promise<RecoveryItem> {
        const [newItem] = await db.insert(recoveryItems).values(item).returning();
        return newItem;
    }

    async updateRecoveryItem(id: string, updates: Partial<InsertRecoveryItem>): Promise<RecoveryItem | undefined> {
        const [updated] = await db.update(recoveryItems).set(updates).where(eq(recoveryItems.id, id)).returning();
        return updated || undefined;
    }

    // Case activity operations
    async getCaseActivities(caseId: string): Promise<CaseActivity[]> {
        return await db.select().from(caseActivities).where(eq(caseActivities.caseId, caseId)).orderBy(desc(caseActivities.timestamp));
    }

    async createCaseActivity(activity: InsertCaseActivity): Promise<CaseActivity> {
        const [newActivity] = await db.insert(caseActivities).values(activity).returning();
        return newActivity;
    }

    // Dashboard analytics
    async getDashboardMetrics(): Promise<{
        totalSavings: number;
        activeCases: number;
        recoveryInProgress: number;
        duplicatesDetected: number;
    }> {
        const [savingsResult] = await db.select({
            total: sql<number>`0`
        }).from(cases);

        const [activeCasesResult] = await db.select({
            count: sql<number>`COUNT(*)`
        }).from(cases).where(eq(cases.status, 'open'));

        const [recoveryResult] = await db.select({
            count: sql<number>`COUNT(*)`
        }).from(recoveryItems).where(eq(recoveryItems.status, 'initiated'));

        const [duplicatesResult] = await db.select({
            count: sql<number>`COUNT(*)`
        }).from(invoices).where(inArray(invoices.lifecycleState, ['CONFIRMED_DUPLICATE']));

        return {
            totalSavings: Number(savingsResult?.total || 0),
            activeCases: Number(activeCasesResult?.count || 0),
            recoveryInProgress: Number(recoveryResult?.count || 0),
            duplicatesDetected: Number(duplicatesResult?.count || 0),
        };
    }
}

export const storage = new DatabaseStorage();
