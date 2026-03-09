import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp, boolean, index, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    username: text("username").notNull().unique(), // Key for auth
    password: text("password").notNull(),
    email: text("email").unique(),
    fullName: text("full_name"),
    role: text("role").default("Auditor"),
    status: text("status").default("Active"),
    authMethod: text("auth_method").default("Email"),
    createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
    username: true,
    password: true,
    email: true,
    fullName: true,
    role: true,
    status: true,
    authMethod: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Role Permissions table
export const rolePermissions = pgTable("role_permissions", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    role: text("role").notNull().unique(), // e.g., 'Auditor', 'AP Manager', 'ADMINISTRATOR'
    allowedTabs: text("allowed_tabs").array(), // e.g., ['Dashboard', 'Reports']
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertRolePermissionSchema = createInsertSchema(rolePermissions).omit({
    id: true,
    updatedAt: true,
});

export type InsertRolePermission = z.infer<typeof insertRolePermissionSchema>;
export type RolePermission = typeof rolePermissions.$inferSelect;

// API Tokens table
export const apiTokens = pgTable("api_tokens", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    token: text("token").notNull(), // In a real app, store hash. Display only once.
    maskedToken: text("masked_token"), // For display
    lastUsed: timestamp("last_used"),
    createdAt: timestamp("created_at").defaultNow(),
    status: text("status").default("Active"),
});

export const insertApiTokenSchema = createInsertSchema(apiTokens).omit({
    id: true,
    createdAt: true,
});

export type InsertApiToken = z.infer<typeof insertApiTokenSchema>;
export type ApiToken = typeof apiTokens.$inferSelect;

// Vendors table
export const vendors = pgTable("vendors", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    erpType: text("erp_type").notNull().default("SAP"),
    companyCode: text("company_code").notNull().default("1000"),
    vendorCode: text("vendor_code").notNull(),
    name: text("name").notNull(),
    taxId: text("tax_id"),
    iban: text("iban"),
    swiftBic: text("swift_bic"),
    address: text("address"),
    addressLine1: text("address_line_1"),
    postalCode: text("postal_code"),
    country: text("country"),
    phoneNumber: text("phone_number"),
    email: text("email"),
    totalSpend: decimal("total_spend", { precision: 15, scale: 2 }).notNull().default("0"),
    duplicateCount: integer("duplicate_count").notNull().default(0),
    paymentTerms: text("payment_terms"),
    riskLevel: text("risk_level").notNull().default("low"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    taxIdIdx: index("vendor_tax_id_idx").on(table.taxId),
    ibanIdx: index("vendor_iban_idx").on(table.iban),
    vendorCodeIdx: index("vendor_code_idx").on(table.vendorCode),
}));

export const insertVendorSchema = createInsertSchema(vendors).omit({
    id: true,
    createdAt: true,
});

export type InsertVendor = z.infer<typeof insertVendorSchema>;
export type Vendor = typeof vendors.$inferSelect;

// Payment Proposals Idempotency tables
export const paymentProposals = pgTable("payment_proposals", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    erpType: text("erp_type").notNull(),
    companyCode: text("company_code").notNull(),
    uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("DRAFT"), // DRAFT, VALIDATED, COMMITTED
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentProposalItems = pgTable("payment_proposal_items", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    proposalId: varchar("proposal_id").notNull().references(() => paymentProposals.id, { onDelete: "cascade" }),
    vendorCode: text("vendor_code").notNull(),
    vendorId: varchar("vendor_id"), // nullable until resolved
    invoiceNumber: text("invoice_number").notNull(),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    invoiceDate: timestamp("invoice_date").notNull(),
    currency: text("currency").notNull().default("USD"),
    valueDate: timestamp("value_date"),
    payee: text("payee"),
    bank: text("bank"),
    lineStatus: text("line_status").notNull().default("CLEAN"), // CLEAN, FLAGGED_LOW, FLAGGED_MEDIUM, FLAGGED_HIGH
    matchSummary: jsonb("match_summary"),
    groupId: varchar("group_id"),
    matchSource: text("match_source"), // Intra-Proposal Duplicate, Historical Data Match, Mixed Match
    matchingReason: text("matching_reason"),
    systemComments: text("system_comments"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    unqIdx: index("pay_prop_item_unq_idx").on(table.proposalId, table.invoiceNumber, table.vendorCode, table.amount, table.invoiceDate),
}));

// Cases table (Refactored)
export const cases = pgTable("cases", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    primaryInvoiceId: varchar("primary_invoice_id").notNull(), // FK mapped in relations below
    caseType: text("case_type").notNull().default("PREVENTION"), // PREVENTION, RECOVERY
    status: text("status").notNull().default("OPEN"), // OPEN, INVESTIGATING, CONFIRMED_DUPLICATE, NOT_DUPLICATE, RESOLVED
    assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCaseSchema = createInsertSchema(cases).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

// Case Events table
export const caseEvents = pgTable("case_events", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    notes: text("notes"),
    actorUserId: varchar("actor_user_id").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CaseEvent = typeof caseEvents.$inferSelect;

// Invoices table
export const invoices = pgTable("invoices", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sourceType: text("source_type").notNull().default("HISTORICAL"), // HISTORICAL | PROPOSAL
    proposalId: varchar("proposal_id").references(() => paymentProposals.id), // Nullable FK
    erpType: text("erp_type").notNull().default("SAP"),
    companyCode: text("company_code").notNull().default("1000"),
    vendorCode: text("vendor_code").notNull().default(""), // Denormalized for high-perf search
    postingDate: timestamp("posting_date"),
    dueDate: timestamp("due_date"),
    currency: text("currency").notNull().default("USD"),
    grossAmount: decimal("gross_amount", { precision: 18, scale: 2 }).notNull().default("0"),
    poNumber: text("po_number"),
    referenceNumber: text("reference_number"),
    paymentStatus: text("payment_status").notNull().default("UNPAID"), // UNPAID | IN_PAYMENT_RUN | PAID | RECOVERY
    paymentDoc: text("payment_doc"),
    paymentDate: timestamp("payment_date"),
    lifecycleState: text("lifecycle_state").notNull().default("INGESTED"), // INGESTED | RISK_SCORED | FLAGGED_HIGH | FLAGGED_MEDIUM | FLAGGED_LOW | IN_INVESTIGATION | CONFIRMED_DUPLICATE | NOT_DUPLICATE | READY_FOR_RELEASE | RELEASED_TO_PAYMENT | PAID | RECOVERY_OPENED | RECOVERY_RESOLVED
    riskScore: integer("risk_score").notNull().default(0),
    confidenceScore: decimal("confidence_score", { precision: 5, scale: 4 }).notNull().default("0"),
    riskBand: text("risk_band").notNull().default("LOW"), // LOW | MEDIUM | HIGH
    isDuplicateCandidate: boolean("is_duplicate_candidate").notNull().default(false),
    confirmedDuplicate: boolean("confirmed_duplicate").notNull().default(false),
    duplicateGroupId: varchar("duplicate_group_id"),
    matchSource: text("match_source"),
    matchingReason: text("matching_reason"),
    systemComments: text("system_comments"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),

    // Legacy Fields map
    invoiceNumber: text("invoice_number").notNull(),
    vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
    invoiceDate: timestamp("invoice_date").notNull(),
    docId: text("doc_id"),
    similarityScore: integer("similarity_score"),
    signals: text("signals").array(),
    investigationNotes: text("investigation_notes"),
    statusUpdatedAt: timestamp("status_updated_at").defaultNow(),
    statusUpdatedBy: varchar("status_updated_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    escalated: boolean("escalated").notNull().default(false),
    locked: boolean("locked").notNull().default(false),
    erpSyncStatus: text("erp_sync_status").notNull().default("PENDING"),
}, (table) => ({
    // High-performance indexes
    compDateIdx: index("invoices_comp_date_idx").on(table.companyCode, table.invoiceDate),
    vendNumIdx: index("invoices_vend_num_idx").on(table.vendorCode, table.invoiceNumber),
    lifecycleDateIdx: index("invoices_lifecycle_date_idx").on(table.lifecycleState, table.invoiceDate),
    payStatusDateIdx: index("invoices_paystatus_date_idx").on(table.paymentStatus, table.paymentDate),
    riskBandScoreIdx: index("invoices_risk_band_score_idx").on(table.riskBand, table.riskScore),
    dupGroupIdIdx: index("invoices_dup_group_id_idx").on(table.duplicateGroupId),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
    vendor: one(vendors, {
        fields: [invoices.vendorId],
        references: [vendors.id],
    }),
    recoveryItems: many(recoveryItems),
    auditLogs: many(auditLog),
}));

export const insertInvoiceSchema = createInsertSchema(invoices).omit({
    id: true,
    createdAt: true,
});

export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

export const matchCandidates = pgTable("match_candidates", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    matchedInvoiceId: varchar("matched_invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    riskBand: text("risk_band").notNull(),
    rulesTriggered: jsonb("rules_triggered"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    unqIdx: index("match_cand_unq_idx").on(table.invoiceId, table.matchedInvoiceId),
}));

export const duplicateGroups = pgTable("duplicate_groups", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    primaryInvoiceId: varchar("primary_invoice_id").notNull().references(() => invoices.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const exportHistory = pgTable("export_history", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
    exportType: text("export_type").notNull(),
    createdBy: varchar("created_by").references(() => users.id, { onDelete: "restrict" }),
    filePayloadRef: text("file_payload_ref"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

// New Rebuilt Payment Batch Tables
export const paymentBatches = pgTable("payment_batches", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
    totalCount: integer("total_count").notNull(),
    exportFormat: text("export_format").notNull(), // EXCEL, CSV, XML, JSON, IDOC, SWIFT
    status: text("status").notNull().default("EXPORTED"), // EXPORTED, REVERSED
    contentFingerprint: text("content_fingerprint"), // deduplication key
    createdBy: varchar("created_by").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentBatchItems = pgTable("payment_batch_items", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    batchId: varchar("batch_id").notNull().references(() => paymentBatches.id, { onDelete: "cascade" }),
    invoiceId: varchar("invoice_id").notNull(), // Unconstrained link to raw proposition strings
    vendorCode: text("vendor_code"),
    invoiceNumber: text("invoice_number"),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
});

export const paymentBatchesRelations = relations(paymentBatches, ({ many, one }) => ({
    items: many(paymentBatchItems),
    creator: one(users, {
        fields: [paymentBatches.createdBy],
        references: [users.id],
    }),
}));

export const paymentBatchItemsRelations = relations(paymentBatchItems, ({ one }) => ({
    batch: one(paymentBatches, {
        fields: [paymentBatchItems.batchId],
        references: [paymentBatches.id],
    }),
}));

// Recovery Items table
export const recoveryItems = pgTable("recovery_items", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    status: text("status").notNull().default("initiated"),
    vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "restrict" }),
    assignedAnalyst: varchar("assigned_analyst").references(() => users.id, { onDelete: "restrict" }),
    recoveryMethod: text("recovery_method").notNull(),
    notes: text("notes"),
    initiatedDate: timestamp("initiated_date").notNull().defaultNow(),
    resolvedDate: timestamp("resolved_date"),
});

export const recoveryItemsRelations = relations(recoveryItems, ({ one }) => ({
    invoice: one(invoices, {
        fields: [recoveryItems.invoiceId],
        references: [invoices.id],
    }),
    vendor: one(vendors, {
        fields: [recoveryItems.vendorId],
        references: [vendors.id],
    }),
    analyst: one(users, {
        fields: [recoveryItems.assignedAnalyst],
        references: [users.id],
    }),
}));

export const insertRecoveryItemSchema = createInsertSchema(recoveryItems).omit({
    id: true,
    initiatedDate: true,
});

export type InsertRecoveryItem = z.infer<typeof insertRecoveryItemSchema>;
export type RecoveryItem = typeof recoveryItems.$inferSelect;

// Case Activities table (Legacy, mapping to new ones if needed, or keep for other things)
export const caseActivities = pgTable("case_activities", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    caseId: varchar("case_id").notNull().references(() => cases.id, { onDelete: "restrict" }),
    userId: varchar("user_id").references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    notes: text("notes"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const caseActivitiesRelations = relations(caseActivities, ({ one }) => ({
    case: one(cases, {
        fields: [caseActivities.caseId],
        references: [cases.id],
    }),
    user: one(users, {
        fields: [caseActivities.userId],
        references: [users.id],
    }),
}));

export const insertCaseActivitySchema = createInsertSchema(caseActivities).omit({
    id: true,
    timestamp: true,
});

export type InsertCaseActivity = z.infer<typeof insertCaseActivitySchema>;
export type CaseActivity = typeof caseActivities.$inferSelect;

// Relations for users
export const usersRelations = relations(users, ({ many }) => ({
    assignedCases: many(cases),
    recoveryItems: many(recoveryItems),
    activities: many(caseActivities),
    events: many(caseEvents),
}));

// Relations for vendors
export const vendorsRelations = relations(vendors, ({ many }) => ({
    invoices: many(invoices),
    recoveryItems: many(recoveryItems),
}));

export const casesRelations = relations(cases, ({ one, many }) => ({
    assignedUser: one(users, {
        fields: [cases.assignedTo],
        references: [users.id],
    }),
    events: many(caseEvents),
}));

// DPPS Configuration table
export const dppsConfig = pgTable("dpps_config", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    criticalThreshold: decimal("critical_threshold", { precision: 5, scale: 3 }).notNull().default("0.85"),
    highThreshold: decimal("high_threshold", { precision: 5, scale: 3 }).notNull().default("0.70"),
    mediumThreshold: decimal("medium_threshold", { precision: 5, scale: 3 }).notNull().default("0.50"),
    invoicePatternTrigger: decimal("invoice_pattern_trigger", { precision: 5, scale: 3 }).notNull().default("0.80"),
    dateProximityDays: integer("date_proximity_days").notNull().default(7),
    fuzzyAmountTolerance: decimal("fuzzy_amount_tolerance", { precision: 5, scale: 3 }).notNull().default("0.005"),
    legalEntityScope: text("legal_entity_scope").notNull().default("within"),
    reportingCurrency: text("reporting_currency").notNull().default("USD"),
    showSideBySideAmounts: boolean("show_side_by_side_amounts").notNull().default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDppsConfigSchema = createInsertSchema(dppsConfig).omit({
    id: true,
    updatedAt: true,
});

export type InsertDppsConfig = z.infer<typeof insertDppsConfigSchema>;
export type DppsConfig = typeof dppsConfig.$inferSelect;

// Recovery Activities table
export const recoveryActivities = pgTable("recovery_activities", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    recoveryItemId: varchar("recovery_item_id").notNull().references(() => recoveryItems.id, { onDelete: "restrict" }),
    userId: varchar("user_id").references(() => users.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    notes: text("notes"),
    evidenceType: text("evidence_type"),
    timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const recoveryActivitiesRelations = relations(recoveryActivities, ({ one }) => ({
    recoveryItem: one(recoveryItems, {
        fields: [recoveryActivities.recoveryItemId],
        references: [recoveryItems.id],
    }),
    user: one(users, {
        fields: [recoveryActivities.userId],
        references: [users.id],
    }),
}));

export const insertRecoveryActivitySchema = createInsertSchema(recoveryActivities).omit({
    id: true,
    timestamp: true,
});

export type InsertRecoveryActivity = z.infer<typeof insertRecoveryActivitySchema>;
export type RecoveryActivity = typeof recoveryActivities.$inferSelect;

// Customers table
export const customers = pgTable("customers", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    customerNumber: text("customer_number").notNull().unique(), // e.g. KUNNR
    name: text("name").notNull(),
    taxId: text("tax_id"),
    billingAddress: text("billing_address"),
    shippingAddress: text("shipping_address"),
    email: text("email"),
    phone: text("phone"),
    iban: text("iban"),
    companyCode: text("company_code"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    taxIdIdx: index("customer_tax_id_idx").on(table.taxId),
    ibanIdx: index("customer_iban_idx").on(table.iban),
}));

export const insertCustomerSchema = createInsertSchema(customers).omit({
    id: true,
    createdAt: true,
});

export type InsertCustomer = z.infer<typeof insertCustomerSchema>;
export type Customer = typeof customers.$inferSelect;

// Financial Documents table
export const financialDocuments = pgTable("financial_documents", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    documentNumber: text("document_number").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    vendorId: varchar("vendor_id").references(() => vendors.id, { onDelete: "restrict" }),
    customerId: varchar("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    invoiceDate: timestamp("invoice_date").notNull(),
    postingDate: timestamp("posting_date"),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    currency: text("currency").notNull().default("USD"),
    taxAmount: decimal("tax_amount", { precision: 15, scale: 2 }),
    poNumber: text("po_number"),
    companyCode: text("company_code"),
    referenceNumber: text("reference_number"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    docNumberIdx: index("fin_doc_number_idx").on(table.documentNumber),
    invNumberIdx: index("fin_inv_number_idx").on(table.invoiceNumber),
}));

export const insertFinancialDocumentSchema = createInsertSchema(financialDocuments).omit({
    id: true,
    createdAt: true,
});

export type InsertFinancialDocument = z.infer<typeof insertFinancialDocumentSchema>;
export type FinancialDocument = typeof financialDocuments.$inferSelect;

// Upload Batches table
export const uploadBatches = pgTable("upload_batches", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    uploadedBy: varchar("uploaded_by").references(() => users.id, { onDelete: "restrict" }),
    erpType: text("erp_type").notNull(), // SAP, Dynamics, Oracle, Sage, Other
    entityType: text("entity_type").notNull(), // Vendors, Customers, Financial
    status: text("status").notNull().default("processing"), // processing, pending_review, completed, error
    totalRows: integer("total_rows").notNull().default(0),
    errorRows: integer("error_rows").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUploadBatchSchema = createInsertSchema(uploadBatches).omit({
    id: true,
    createdAt: true,
});

export type InsertUploadBatch = z.infer<typeof insertUploadBatchSchema>;
export type UploadBatch = typeof uploadBatches.$inferSelect;

// Historical Data Staging Table (Preview Before Save Phase 7)
export const historicalStaging = pgTable("historical_staging", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    batchId: varchar("batch_id").notNull().references(() => uploadBatches.id, { onDelete: "restrict" }),
    entityType: text("entity_type").notNull(), // 'vendors', 'customers', or 'financial_documents'
    rowData: jsonb("row_data").notNull(), // The loosely parsed data ready for the entity table
    validationErrors: text("validation_errors").array(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHistoricalStagingSchema = createInsertSchema(historicalStaging).omit({
    id: true,
    createdAt: true,
});

export type InsertHistoricalStaging = z.infer<typeof insertHistoricalStagingSchema>;
export type HistoricalStaging = typeof historicalStaging.$inferSelect;

// Duplicate Results table
export const duplicateResults = pgTable("duplicate_results", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    doc1Id: varchar("doc1_id").notNull().references(() => financialDocuments.id, { onDelete: "restrict" }),
    doc2Id: varchar("doc2_id").notNull().references(() => financialDocuments.id, { onDelete: "restrict" }),
    similarityScore: integer("similarity_score").notNull(),
    riskClassification: text("risk_classification").notNull(), // Low, Medium, High, Critical
    explanation: text("explanation"), // JSON or text explanation of match
    status: text("status").notNull().default("open"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDuplicateResultSchema = createInsertSchema(duplicateResults).omit({
    id: true,
    createdAt: true,
});

export type InsertDuplicateResult = z.infer<typeof insertDuplicateResultSchema>;
export type DuplicateResult = typeof duplicateResults.$inferSelect;

// Audit Log table
export const auditLog = pgTable("audit_log", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    invoiceId: varchar("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    action: text("action").notNull(), // e.g., 'STATUS_CHANGE', 'OVERRIDE', 'ESCALATION', 'RELEASE'
    riskScore: integer("risk_score"),
    metadata: jsonb("metadata"), // e.g., { reason: '...', previousStatus: '...' }
    userId: varchar("user_id").references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const auditLogRelations = relations(auditLog, ({ one }) => ({
    invoice: one(invoices, {
        fields: [auditLog.invoiceId],
        references: [invoices.id],
    }),
    user: one(users, {
        fields: [auditLog.userId],
        references: [users.id],
    }),
}));

export const insertAuditLogSchema = createInsertSchema(auditLog).omit({
    id: true,
    createdAt: true,
});

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type AuditLog = typeof auditLog.$inferSelect;

// Report Templates table
export const reportTemplates = pgTable("report_templates", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    description: text("description"),
    filters: jsonb("filters").notNull(), // Stores applied date ranges, selected vendors, risk bands, etc.
    columns: jsonb("columns"), // Optional: to store which columns were visible/hidden
    createdBy: varchar("created_by").references(() => users.id, { onDelete: "restrict" }),
    isPublic: boolean("is_public").notNull().default(false), // e.g., 'Executive Monthly Summary' shared across org
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const reportTemplatesRelations = relations(reportTemplates, ({ one }) => ({
    user: one(users, {
        fields: [reportTemplates.createdBy],
        references: [users.id],
    }),
}));

export const insertReportTemplateSchema = createInsertSchema(reportTemplates).omit({
    id: true,
    createdAt: true,
    updatedAt: true,
});

export type InsertReportTemplate = z.infer<typeof insertReportTemplateSchema>;
export type ReportTemplate = typeof reportTemplates.$inferSelect;

export const workflowEvents = pgTable("workflow_events", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
    fromState: text("from_state").notNull(),
    toState: text("to_state").notNull(),
    actorUserId: text("actor_user_id").notNull(),
    reasonCode: text("reason_code").notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => ({
    invCreateIdx: index("workflow_events_inv_create_idx").on(table.invoiceId, table.createdAt),
}));

export const enterpriseRecoveryCases = pgTable("enterprise_recovery_cases", {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    invoiceId: varchar("invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("OPEN"),
    recoveredAmount: decimal("recovered_amount", { precision: 18, scale: 2 }),
    recoveredDate: timestamp("recovered_date"),
    ownerUserId: text("owner_user_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => ({
    statusCreateIdx: index("ent_recov_status_create_idx").on(table.status, table.createdAt),
}));
