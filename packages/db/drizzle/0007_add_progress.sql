CREATE TYPE "app"."progress_status" AS ENUM('planned', 'in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "app"."progress" (
	"user_id" uuid NOT NULL,
	"catalog_item_id" uuid NOT NULL,
	"status" "app"."progress_status",
	"rating" smallint,
	"review" text,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "progress_user_id_catalog_item_id_pk" PRIMARY KEY("user_id","catalog_item_id"),
	CONSTRAINT "progress_rating_range" CHECK ("app"."progress"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "app"."progress" ADD CONSTRAINT "progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."progress" ADD CONSTRAINT "progress_catalog_item_id_catalog_item_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "app"."catalog_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "progress_catalog_item_id_idx" ON "app"."progress" USING btree ("catalog_item_id");