ALTER TABLE "user" ADD COLUMN "tos_accepted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "tos_accepted_at" timestamp with time zone;