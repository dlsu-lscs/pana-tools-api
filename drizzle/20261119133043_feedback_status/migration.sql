CREATE TYPE "feedback_status" AS ENUM('unresolved', 'pending', 'resolved');--> statement-breakpoint
ALTER TABLE "feedback" ADD COLUMN "status" "feedback_status" DEFAULT 'unresolved'::"feedback_status" NOT NULL;--> statement-breakpoint
CREATE INDEX "feedback_status_idx" ON "feedback" ("status");