CREATE TYPE "app"."check_rule" AS ENUM('title_style', 'extra_words', 'missing_volume', 'volume_mismatch', 'duplicate_volume', 'wrong_series', 'series_spelling', 'duplicate_series');--> statement-breakpoint
CREATE TABLE "app"."catalog_check" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"catalog_item_id" uuid,
	"series_id" uuid,
	"rule" "app"."check_rule" NOT NULL,
	"message" text NOT NULL,
	"fix" text,
	"confidence" real,
	"dismissed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."catalog_check" ADD CONSTRAINT "catalog_check_catalog_item_id_catalog_item_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "app"."catalog_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."catalog_check" ADD CONSTRAINT "catalog_check_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "app"."series"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_check_catalog_item_id_idx" ON "app"."catalog_check" USING btree ("catalog_item_id");--> statement-breakpoint
CREATE INDEX "catalog_check_series_id_idx" ON "app"."catalog_check" USING btree ("series_id");