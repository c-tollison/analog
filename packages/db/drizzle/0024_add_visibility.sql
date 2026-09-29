ALTER TABLE "app"."user" ADD COLUMN "is_public" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."collection" ADD COLUMN "is_public" boolean DEFAULT true NOT NULL;