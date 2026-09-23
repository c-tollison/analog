ALTER TYPE "app"."external_source" ADD VALUE 'anilist';--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "details_source" "app"."external_source";--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "details_id" text;--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "details" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "details_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "volume_count" integer;--> statement-breakpoint
-- Books pick up the new Open Library fields and romanized author names the
-- next time their page is opened.
UPDATE "app"."catalog_item" SET "details_fetched_at" = NULL WHERE "external_source" = 'openlibrary';
