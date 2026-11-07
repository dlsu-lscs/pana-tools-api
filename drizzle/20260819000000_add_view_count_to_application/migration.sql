ALTER TABLE "application" ADD COLUMN "view_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "application_view_count_idx" ON "application" ("view_count");