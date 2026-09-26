ALTER TABLE "app"."catalog_item" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "language" text;--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "verified_by_user_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD CONSTRAINT "catalog_item_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "app"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."series" ADD CONSTRAINT "series_verified_by_user_id_user_id_fk" FOREIGN KEY ("verified_by_user_id") REFERENCES "app"."user"("id") ON DELETE set null ON UPDATE no action;