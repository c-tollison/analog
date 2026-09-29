ALTER TABLE "app"."user" ALTER COLUMN "is_public" SET DEFAULT true;--> statement-breakpoint
UPDATE "app"."user" SET "is_public" = true;
