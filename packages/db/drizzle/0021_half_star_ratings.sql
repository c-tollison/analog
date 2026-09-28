-- Ratings now count half stars, so existing whole-star ratings double.
ALTER TABLE "app"."progress" DROP CONSTRAINT "progress_rating_range";--> statement-breakpoint
UPDATE "app"."progress" SET "rating" = "rating" * 2 WHERE "rating" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."progress" ADD CONSTRAINT "progress_rating_range" CHECK ("app"."progress"."rating" between 1 and 10);
