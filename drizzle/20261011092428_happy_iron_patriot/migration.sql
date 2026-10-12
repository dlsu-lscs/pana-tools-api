CREATE TYPE "report_reason" AS ENUM('spam', 'inappropriate', 'misleading', 'offensive', 'other');--> statement-breakpoint
CREATE TYPE "report_status" AS ENUM('pending', 'reviewed', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "report_target_type" AS ENUM('application', 'review');--> statement-breakpoint
CREATE TABLE "report" (
	"id" serial PRIMARY KEY,
	"reporter_id" text NOT NULL,
	"target_type" "report_target_type" NOT NULL,
	"target_id" integer NOT NULL,
	"reason" "report_reason" NOT NULL,
	"description" text,
	"status" "report_status" DEFAULT 'pending'::"report_status" NOT NULL,
	"admin_note" text,
	"reviewed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_reporter_target_unq" UNIQUE("reporter_id","target_type","target_id")
);
--> statement-breakpoint
ALTER TABLE "rating" ADD COLUMN "id" serial;--> statement-breakpoint
ALTER TABLE "rating" ADD CONSTRAINT "rating_id_unq" UNIQUE("id");--> statement-breakpoint
CREATE INDEX "report_reporter_id_idx" ON "report" ("reporter_id");--> statement-breakpoint
CREATE INDEX "report_target_type_idx" ON "report" ("target_type");--> statement-breakpoint
CREATE INDEX "report_status_idx" ON "report" ("status");--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "user"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "report" ADD CONSTRAINT "report_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "user"("id") ON DELETE SET NULL;