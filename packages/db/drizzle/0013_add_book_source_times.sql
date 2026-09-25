ALTER TABLE "app"."catalog_item" ADD COLUMN "google_books_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD COLUMN "open_library_fetched_at" timestamp with time zone;--> statement-breakpoint
-- Books whose data came from Google Books already have it. Everything else
-- is looked up again on each source that hasn't answered.
UPDATE "app"."catalog_item" SET "google_books_fetched_at" = "updated_at" WHERE "external_source" = 'googlebooks';
