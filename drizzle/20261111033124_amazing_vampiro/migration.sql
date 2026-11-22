CREATE TYPE "feedback_category" AS ENUM('bug', 'feature_request', 'general', 'improvement');--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" text PRIMARY KEY,
	"user_id" text,
	"email" text,
	"category" "feedback_category" NOT NULL,
	"message" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "feedback_user_id_idx" ON "feedback" ("user_id");--> statement-breakpoint
CREATE INDEX "feedback_category_idx" ON "feedback" ("category");--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE;