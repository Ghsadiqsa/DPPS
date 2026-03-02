CREATE TABLE "api_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"token" text NOT NULL,
	"masked_token" text,
	"last_used" timestamp,
	"created_at" timestamp DEFAULT now(),
	"status" text DEFAULT 'Active'
);
--> statement-breakpoint
CREATE TABLE "case_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar NOT NULL,
	"user_id" varchar,
	"action" text NOT NULL,
	"notes" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_number" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"assigned_to" varchar,
	"total_amount" numeric(15, 2) NOT NULL,
	"potential_savings" numeric(15, 2) NOT NULL,
	"risk_score" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cases_case_number_unique" UNIQUE("case_number")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_number" text NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"billing_address" text,
	"shipping_address" text,
	"email" text,
	"phone" text,
	"iban" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_customer_number_unique" UNIQUE("customer_number")
);
--> statement-breakpoint
CREATE TABLE "dpps_config" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"critical_threshold" integer DEFAULT 85 NOT NULL,
	"high_threshold" integer DEFAULT 70 NOT NULL,
	"medium_threshold" integer DEFAULT 50 NOT NULL,
	"invoice_pattern_trigger" integer DEFAULT 80 NOT NULL,
	"date_proximity_days" integer DEFAULT 7 NOT NULL,
	"fuzzy_amount_tolerance" numeric(5, 3) DEFAULT '0.005' NOT NULL,
	"legal_entity_scope" text DEFAULT 'within' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duplicate_results" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"doc1_id" varchar NOT NULL,
	"doc2_id" varchar NOT NULL,
	"similarity_score" integer NOT NULL,
	"risk_classification" text NOT NULL,
	"explanation" text,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "financial_documents" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_number" text NOT NULL,
	"invoice_number" text NOT NULL,
	"vendor_id" varchar,
	"customer_id" varchar,
	"invoice_date" timestamp NOT NULL,
	"posting_date" timestamp,
	"amount" numeric(15, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"tax_amount" numeric(15, 2),
	"po_number" text,
	"company_code" text,
	"reference_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" varchar,
	"invoice_number" text NOT NULL,
	"vendor_id" varchar NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"doc_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"similarity_score" integer,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"matched_invoice_id" varchar,
	"signals" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recovery_item_id" varchar NOT NULL,
	"user_id" varchar,
	"action" text NOT NULL,
	"notes" text,
	"evidence_type" text,
	"timestamp" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recovery_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar,
	"amount" numeric(15, 2) NOT NULL,
	"status" text DEFAULT 'initiated' NOT NULL,
	"vendor_id" varchar,
	"assigned_analyst" varchar,
	"recovery_method" text NOT NULL,
	"notes" text,
	"initiated_date" timestamp DEFAULT now() NOT NULL,
	"resolved_date" timestamp
);
--> statement-breakpoint
CREATE TABLE "upload_batches" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uploaded_by" varchar,
	"erp_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"status" text DEFAULT 'processing' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"error_rows" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"password" text NOT NULL,
	"email" text,
	"full_name" text,
	"role" text DEFAULT 'Auditor',
	"status" text DEFAULT 'Active',
	"auth_method" text DEFAULT 'Email',
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"tax_id" text,
	"iban" text,
	"swift_bic" text,
	"address_line_1" text,
	"postal_code" text,
	"country" text,
	"phone_number" text,
	"email" text,
	"total_spend" numeric(15, 2) DEFAULT '0' NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"payment_terms" text,
	"risk_level" text DEFAULT 'low' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "case_activities" ADD CONSTRAINT "case_activities_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activities" ADD CONSTRAINT "case_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_results" ADD CONSTRAINT "duplicate_results_doc1_id_financial_documents_id_fk" FOREIGN KEY ("doc1_id") REFERENCES "public"."financial_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_results" ADD CONSTRAINT "duplicate_results_doc2_id_financial_documents_id_fk" FOREIGN KEY ("doc2_id") REFERENCES "public"."financial_documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_activities" ADD CONSTRAINT "recovery_activities_recovery_item_id_recovery_items_id_fk" FOREIGN KEY ("recovery_item_id") REFERENCES "public"."recovery_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_activities" ADD CONSTRAINT "recovery_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_items" ADD CONSTRAINT "recovery_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_items" ADD CONSTRAINT "recovery_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_items" ADD CONSTRAINT "recovery_items_assigned_analyst_users_id_fk" FOREIGN KEY ("assigned_analyst") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "customer_tax_id_idx" ON "customers" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "customer_iban_idx" ON "customers" USING btree ("iban");--> statement-breakpoint
CREATE INDEX "fin_doc_number_idx" ON "financial_documents" USING btree ("document_number");--> statement-breakpoint
CREATE INDEX "fin_inv_number_idx" ON "financial_documents" USING btree ("invoice_number");--> statement-breakpoint
CREATE INDEX "fin_inv_number_trgm_idx" ON "financial_documents" USING gin (("invoice_number" gin_trgm_ops));--> statement-breakpoint
CREATE INDEX "vendor_tax_id_idx" ON "vendors" USING btree ("tax_id");--> statement-breakpoint
CREATE INDEX "vendor_iban_idx" ON "vendors" USING btree ("iban");