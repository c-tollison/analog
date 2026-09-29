CREATE TABLE "app"."catalog_item_isbn_cover" (
	"isbn" text PRIMARY KEY NOT NULL,
	"data" "bytea" NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn_cover" ADD CONSTRAINT "catalog_item_isbn_cover_isbn_catalog_item_isbn_isbn_fk" FOREIGN KEY ("isbn") REFERENCES "app"."catalog_item_isbn"("isbn") ON DELETE cascade ON UPDATE no action;