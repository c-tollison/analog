ALTER TABLE "app"."catalog_item" ADD COLUMN "save_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD COLUMN "rating_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD COLUMN "rating_average" real;--> statement-breakpoint
DELETE FROM "app"."collection_item" e
WHERE NOT EXISTS (
	SELECT 1 FROM "app"."collection_item_isbn" o WHERE o."collection_item_id" = e."id"
);--> statement-breakpoint
UPDATE "app"."catalog_item" ci
SET "save_count" = s."saves", "rating_count" = s."ratings", "rating_average" = s."average"
FROM (
	SELECT "catalog_item_id",
		count("status")::int AS "saves",
		count("rating") FILTER (WHERE "status" = 'completed')::int AS "ratings",
		avg("rating") FILTER (WHERE "status" = 'completed')::real AS "average"
	FROM "app"."progress"
	GROUP BY "catalog_item_id"
) s
WHERE ci."id" = s."catalog_item_id";--> statement-breakpoint
UPDATE "app"."series" s
SET "cover_url" = (
	SELECT ci."cover_url" FROM "app"."catalog_item" ci
	WHERE ci."series_id" = s."id" AND ci."cover_url" IS NOT NULL
	ORDER BY ci."position" ASC NULLS LAST, ci."release_date" ASC NULLS LAST
	LIMIT 1
)
WHERE s."external_source" IS NULL;
