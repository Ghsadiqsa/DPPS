ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "case_activities" DROP CONSTRAINT "case_activities_case_id_cases_id_fk";
--> statement-breakpoint
ALTER TABLE "case_activities" DROP CONSTRAINT "case_activities_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "cases" DROP CONSTRAINT "cases_assigned_to_users_id_fk";
--> statement-breakpoint
ALTER TABLE "duplicate_results" DROP CONSTRAINT "duplicate_results_doc1_id_financial_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "duplicate_results" DROP CONSTRAINT "duplicate_results_doc2_id_financial_documents_id_fk";
--> statement-breakpoint
ALTER TABLE "financial_documents" DROP CONSTRAINT "financial_documents_vendor_id_vendors_id_fk";
--> statement-breakpoint
ALTER TABLE "financial_documents" DROP CONSTRAINT "financial_documents_customer_id_customers_id_fk";
--> statement-breakpoint
ALTER TABLE "historical_staging" DROP CONSTRAINT "historical_staging_batch_id_upload_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_case_id_cases_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_vendor_id_vendors_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_status_updated_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "payment_proposals" DROP CONSTRAINT "payment_proposals_batch_id_upload_batches_id_fk";
--> statement-breakpoint
ALTER TABLE "recovery_activities" DROP CONSTRAINT "recovery_activities_recovery_item_id_recovery_items_id_fk";
--> statement-breakpoint
ALTER TABLE "recovery_activities" DROP CONSTRAINT "recovery_activities_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "recovery_items" DROP CONSTRAINT "recovery_items_invoice_id_invoices_id_fk";
--> statement-breakpoint
ALTER TABLE "recovery_items" DROP CONSTRAINT "recovery_items_vendor_id_vendors_id_fk";
--> statement-breakpoint
ALTER TABLE "recovery_items" DROP CONSTRAINT "recovery_items_assigned_analyst_users_id_fk";
--> statement-breakpoint
ALTER TABLE "report_templates" DROP CONSTRAINT "report_templates_created_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "upload_batches" DROP CONSTRAINT "upload_batches_uploaded_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "amount" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "company_code" SET DEFAULT '1000';--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "company_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "vendor_code" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "erp_type" text DEFAULT 'SAP' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "company_code" text DEFAULT '1000' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "vendor_code" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "posting_date" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "due_date" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "currency" text DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "gross_amount" numeric(18, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "po_number" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_status" text DEFAULT 'UNPAID' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_doc" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "payment_date" timestamp;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "lifecycle_state" text DEFAULT 'PROPOSAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "risk_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "confidence_score" numeric(5, 4) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "risk_band" text DEFAULT 'LOW' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "is_duplicate_candidate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "confirmed_duplicate" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "duplicate_group_id" varchar;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "erp_type" text DEFAULT 'SAP' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "address" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activities" ADD CONSTRAINT "case_activities_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_activities" ADD CONSTRAINT "case_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_results" ADD CONSTRAINT "duplicate_results_doc1_id_financial_documents_id_fk" FOREIGN KEY ("doc1_id") REFERENCES "public"."financial_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duplicate_results" ADD CONSTRAINT "duplicate_results_doc2_id_financial_documents_id_fk" FOREIGN KEY ("doc2_id") REFERENCES "public"."financial_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "financial_documents" ADD CONSTRAINT "financial_documents_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_staging" ADD CONSTRAINT "historical_staging_batch_id_upload_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_status_updated_by_users_id_fk" FOREIGN KEY ("status_updated_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proposals" ADD CONSTRAINT "payment_proposals_batch_id_upload_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_activities" ADD CONSTRAINT "recovery_activities_recovery_item_id_recovery_items_id_fk" FOREIGN KEY ("recovery_item_id") REFERENCES "public"."recovery_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_activities" ADD CONSTRAINT "recovery_activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_items" ADD CONSTRAINT "recovery_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_items" ADD CONSTRAINT "recovery_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recovery_items" ADD CONSTRAINT "recovery_items_assigned_analyst_users_id_fk" FOREIGN KEY ("assigned_analyst") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_templates" ADD CONSTRAINT "report_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "upload_batches" ADD CONSTRAINT "upload_batches_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoices_comp_date_idx" ON "invoices" USING btree ("company_code","invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_vend_num_idx" ON "invoices" USING btree ("vendor_code","invoice_number");--> statement-breakpoint
CREATE INDEX "invoices_lifecycle_date_idx" ON "invoices" USING btree ("lifecycle_state","invoice_date");--> statement-breakpoint
CREATE INDEX "invoices_paystatus_date_idx" ON "invoices" USING btree ("payment_status","payment_date");--> statement-breakpoint
CREATE INDEX "invoices_risk_band_score_idx" ON "invoices" USING btree ("risk_band","risk_score");--> statement-breakpoint
CREATE INDEX "invoices_dup_group_id_idx" ON "invoices" USING btree ("duplicate_group_id");