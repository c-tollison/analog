-- Trigram matching for title search (trusted extension, no superuser needed).
CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "app"."collection_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TYPE "app"."external_source" AS ENUM('openlibrary');--> statement-breakpoint
CREATE TYPE "app"."media_format" AS ENUM('book', 'dvd', 'bluray', 'uhd_4k');--> statement-breakpoint
CREATE TYPE "app"."series_kind" AS ENUM('manga', 'book', 'tv', 'film');--> statement-breakpoint
CREATE TABLE "app"."catalog_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"format" "app"."media_format" NOT NULL,
	"kind" "app"."series_kind",
	"title" text NOT NULL,
	"series_id" uuid,
	"position" numeric,
	"barcode" text,
	"external_source" "app"."external_source",
	"external_id" text,
	"cover_url" text,
	"release_date" date,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_item_barcode_unique" UNIQUE("barcode")
);
--> statement-breakpoint
CREATE TABLE "app"."collection_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"catalog_item_id" uuid NOT NULL,
	"added_by_user_id" uuid,
	"notes" text,
	"acquired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_item_collection_catalog_unique" UNIQUE("collection_id","catalog_item_id")
);
--> statement-breakpoint
CREATE TABLE "app"."collection_member" (
	"collection_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "app"."collection_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_member_collection_id_user_id_pk" PRIMARY KEY("collection_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "app"."collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"kind" "app"."series_kind" NOT NULL,
	"cover_url" text,
	"external_source" "app"."external_source",
	"external_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "series_external_unique" UNIQUE("external_source","external_id")
);
--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD CONSTRAINT "catalog_item_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "app"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD CONSTRAINT "catalog_item_created_by_user_id_user_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "app"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."collection_item" ADD CONSTRAINT "collection_item_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "app"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."collection_item" ADD CONSTRAINT "collection_item_catalog_item_id_catalog_item_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "app"."catalog_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."collection_item" ADD CONSTRAINT "collection_item_added_by_user_id_user_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "app"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."collection_member" ADD CONSTRAINT "collection_member_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "app"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."collection_member" ADD CONSTRAINT "collection_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_item_series_id_idx" ON "app"."catalog_item" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "catalog_item_title_trgm_idx" ON "app"."catalog_item" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "collection_item_catalog_item_id_idx" ON "app"."collection_item" USING btree ("catalog_item_id");--> statement-breakpoint
CREATE INDEX "collection_member_user_id_idx" ON "app"."collection_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "series_title_trgm_idx" ON "app"."series" USING gin ("title" gin_trgm_ops);