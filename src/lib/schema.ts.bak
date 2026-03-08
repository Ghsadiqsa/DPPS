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

// Cases table
export const cases = pgTable("cases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  caseNumber: text("case_number").notNull().unique(),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  assignedTo: varchar("assigned_to").references(() => users.id, { onDelete: "restrict" }),
  totalAmount: decimal("total_amount", { precision: 15, scale: 2 }).notNull(),
  potentialSavings: decimal("potential_savings", { precision: 15, scale: 2 }).notNull(),
  riskScore: integer("risk_score").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const casesRelations = relations(cases, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [cases.assignedTo],
    references: [users.id],
  }),
  invoices: many(invoices),
  activities: many(caseActivities),
}));

export const insertCaseSchema = createInsertSchema(cases).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCase = z.infer<typeof insertCaseSchema>;
export type Case = typeof cases.$inferSelect;

// Invoices table
export const invoices = pgTable("invoices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  // Enterprise Expansion Fields
  erpType: text("erp_type").notNull().default("SAP"),
  companyCode: text("company_code").notNull().default("1000"),
  vendorCode: text("vendor_code").notNull().default(""), // Denormalized for high-perf search
  postingDate: timestamp("posting_date"),
  dueDate: timestamp("due_date"),
  currency: text("currency").notNull().default("USD"),
  grossAmount: decimal("gross_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  poNumber: text("po_number"),
  paymentStatus: text("payment_status").notNull().default("UNPAID"), // UNPAID|PAID
  paymentDoc: text("payment_doc"),
  paymentDate: timestamp("payment_date"),
  lifecycleState: text("lifecycle_state").notNull().default("PROPOSAL"), // PROPOSAL | RISK_SCORED | POTENTIAL_DUPLICATE | BLOCKED | CLEARED | PAID | PAID_DUPLICATE | RECOVERY | RESOLVED
  riskScore: integer("risk_score").notNull().default(0),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 4 }).notNull().default("0"),
  riskBand: text("risk_band").notNull().default("LOW"), // LOW|MEDIUM|HIGH
  isDuplicateCandidate: boolean("is_duplicate_candidate").notNull().default(false),
  confirmedDuplicate: boolean("confirmed_duplicate").notNull().default(false),
  duplicateGroupId: varchar("duplicate_group_id"), // FK to duplicateGroups will be handled implicitly or explicitly via views
  updatedAt: timestamp("updated_at").notNull().defaultNow(),

  // Legacy Fields mapping
  caseId: varchar("case_id").references(() => cases.id, { onDelete: "restrict" }),
  invoiceNumber: text("invoice_number").notNull(),
  vendorId: varchar("vendor_id").notNull().references(() => vendors.id, { onDelete: "restrict" }),
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull().default("0"),
  invoiceDate: timestamp("invoice_date").notNull(),
  docId: text("doc_id"),
  status: text("status").notNull().default("UPLOADED"),
  similarityScore: integer("similarity_score"),
  isDuplicate: boolean("is_duplicate").notNull().default(false),
  matchedInvoiceId: varchar("matched_invoice_id"),
  signals: text("signals").array(),
  investigationNotes: text("investigation_notes"),
  statusUpdatedAt: timestamp("status_updated_at").defaultNow(),
  statusUpdatedBy: varchar("status_updated_by").references(() => users.id, { onDelete: "restrict" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  escalated: boolean("escalated").notNull().default(false),
  locked: boolean("locked").notNull().default(false),
  erpSyncStatus: text("erp_sync_status").notNull().default("PENDING"),
}, (table) => ({
  // High-performance indexes required by the Enterprise Spec
  compDateIdx: index("invoices_comp_date_idx").on(table.companyCode, table.invoiceDate),
  vendNumIdx: index("invoices_vend_num_idx").on(table.vendorCode, table.invoiceNumber),
  lifecycleDateIdx: index("invoices_lifecycle_date_idx").on(table.lifecycleState, table.invoiceDate),
  payStatusDateIdx: index("invoices_paystatus_date_idx").on(table.paymentStatus, table.paymentDate),
  riskBandScoreIdx: index("invoices_risk_band_score_idx").on(table.riskBand, table.riskScore),
  dupGroupIdIdx: index("invoices_dup_group_id_idx").on(table.duplicateGroupId),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  case: one(cases, {
    fields: [invoices.caseId],
    references: [cases.id],
  }),
  vendor: one(vendors, {
    fields: [invoices.vendorId],
    references: [vendors.id],
  }),
  recoveryItems: many(recoveryItems),
  auditLogs: many(auditLog),
}));

export const InvoiceStatusEnum = z.enum([
  "UPLOADED",
  "AUTO_FLAGGED",
  "UNDER_INVESTIGATION",
  "BLOCKED",
  "CLEARED",
  "PAID_DUPLICATE",
  "RECOVERY_REQUIRED",
  "RECOVERED",
  "HELD"
]);

export const insertInvoiceSchema = createInsertSchema(invoices, {
  status: InvoiceStatusEnum.default("UPLOADED")
}).omit({
  id: true,
  createdAt: true,
});

export type InvoiceStatus = z.infer<typeof InvoiceStatusEnum>;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoices.$inferSelect;

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

// Case Activities table
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
}));

// Relations for vendors
export const vendorsRelations = relations(vendors, ({ many }) => ({
  invoices: many(invoices),
  recoveryItems: many(recoveryItems),
}));

// DPPS Configuration table
export const dppsConfig = pgTable("dpps_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  criticalThreshold: integer("critical_threshold").notNull().default(85),
  highThreshold: integer("high_threshold").notNull().default(70),
  mediumThreshold: integer("medium_threshold").notNull().default(50),
  invoicePatternTrigger: integer("invoice_pattern_trigger").notNull().default(80),
  dateProximityDays: integer("date_proximity_days").notNull().default(7),
  fuzzyAmountTolerance: decimal("fuzzy_amount_tolerance", { precision: 5, scale: 3 }).notNull().default("0.005"),
  legalEntityScope: text("legal_entity_scope").notNull().default("within"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDppsConfigSchema = createInsertSchema(dppsConfig).omit({
  id: true,
  updatedAt: true,
});

export type InsertDppsConfig = z.infer<typeof insertDppsConfigSchema>;
export type DppsConfig = typeof dppsConfig.$inferSelect;

// Recovery Activities table (for tracking recovery workflow)
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

// Payment Proposals Staging Table
export const paymentProposals = pgTable("payment_proposals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  batchId: varchar("batch_id").references(() => uploadBatches.id, { onDelete: "restrict" }),
  invoiceNumber: text("invoice_number").notNull(),
  vendorId: text("vendor_id").notNull(), // text because it might not be formally in our system yet
  amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
  invoiceDate: timestamp("invoice_date").notNull(),
  companyCode: text("company_code"),
  erpSource: text("erp_source"),
  status: text("status").notNull().default("CLEAN"), // 'DUPLICATE', 'FLAGGED', 'CLEAN'
  validationErrors: text("validation_errors").array(),
  duplicateMatchId: varchar("duplicate_match_id"), // Reference to financialDocuments.id if matched
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaymentProposalSchema = createInsertSchema(paymentProposals).omit({
  id: true,
  createdAt: true,
});

export type InsertPaymentProposal = z.infer<typeof insertPaymentProposalSchema>;
export type PaymentProposal = typeof paymentProposals.$inferSelect;

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

export const duplicateGroups = pgTable("duplicate_groups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  primaryInvoiceId: varchar("primary_invoice_id").notNull().references(() => invoices.id, { onDelete: "restrict" }),
  matchType: text("match_type").notNull(),
  explanationJson: jsonb("explanation_json").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

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
