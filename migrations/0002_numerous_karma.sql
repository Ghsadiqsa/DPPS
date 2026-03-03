CREATE TABLE "audit_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" varchar,
	"action" text NOT NULL,
	"risk_score" integer,
	"metadata" jsonb,
	"user_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historical_staging" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar NOT NULL,
	"entity_type" text NOT NULL,
	"row_data" jsonb NOT NULL,
	"validation_errors" text[],
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_proposals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" varchar,
	"invoice_number" text NOT NULL,
	"vendor_id" text NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"invoice_date" timestamp NOT NULL,
	"company_code" text,
	"erp_source" text,
	"status" text DEFAULT 'CLEAN' NOT NULL,
	"validation_errors" text[],
	"duplicate_match_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'UPLOADED';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "investigation_notes" text;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "status_updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "status_updated_by" varchar;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "escalated" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "locked" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "erp_sync_status" text DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "vendor_code" text;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historical_staging" ADD CONSTRAINT "historical_staging_batch_id_upload_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_proposals" ADD CONSTRAINT "payment_proposals_batch_id_upload_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."upload_batches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_status_updated_by_users_id_fk" FOREIGN KEY ("status_updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_code_idx" ON "vendors" USING btree ("vendor_code");