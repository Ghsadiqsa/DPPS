CREATE TABLE "role_permissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"allowed_tabs" text[],
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "role_permissions_role_unique" UNIQUE("role")
);
--> statement-breakpoint
DROP INDEX "fin_inv_number_trgm_idx";--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "company_code" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "company_code" text;