CREATE TYPE "app"."check_trigger" AS ENUM('scan', 'admin', 'refresh', 'sweep');--> statement-breakpoint
CREATE TABLE "app"."catalog_check_run" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" "app"."check_trigger" NOT NULL,
	"catalog_item_id" uuid,
	"series_id" uuid,
	"title" text NOT NULL,
	"requests" integer DEFAULT 0 NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"problems" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."catalog_check_run" ADD CONSTRAINT "catalog_check_run_catalog_item_id_catalog_item_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "app"."catalog_item"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."catalog_check_run" ADD CONSTRAINT "catalog_check_run_series_id_series_id_fk" FOREIGN KEY ("series_id") REFERENCES "app"."series"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_check_run_created_at_idx" ON "app"."catalog_check_run" USING btree ("created_at");