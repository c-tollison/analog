ALTER TABLE "app"."catalog_item" ADD COLUMN "details_fetched_at" timestamp with time zone;--> statement-breakpoint
-- Books that already have a description (even an empty one) were fetched.
UPDATE "app"."catalog_item" SET "details_fetched_at" = now() WHERE "metadata" ? 'description';
