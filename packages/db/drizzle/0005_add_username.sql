ALTER TABLE "app"."user" ADD COLUMN "username" text;--> statement-breakpoint
-- Existing users get a username from their name: lowercased, stripped to
-- a-z 0-9 _ . and capped at 30 characters. Oldest account keeps the plain
-- name; later clashes get 2, 3, ... on the end. Names too short once
-- stripped fall back to "user" plus the start of the id.
DO $$
DECLARE
	u record;
	base text;
	candidate text;
	suffix int;
BEGIN
	FOR u IN SELECT "id", "name" FROM "app"."user" ORDER BY "created_at", "id" LOOP
		base := left(regexp_replace(lower(u."name"), '[^a-z0-9_.]', '', 'g'), 26);
		IF length(base) < 3 THEN
			base := 'user' || left(u."id"::text, 6);
		END IF;
		candidate := base;
		suffix := 1;
		WHILE EXISTS (SELECT 1 FROM "app"."user" WHERE "username" = candidate) LOOP
			suffix := suffix + 1;
			candidate := base || suffix;
		END LOOP;
		UPDATE "app"."user" SET "username" = candidate WHERE "id" = u."id";
	END LOOP;
END $$;--> statement-breakpoint
ALTER TABLE "app"."user" ALTER COLUMN "username" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."user" ADD CONSTRAINT "user_username_unique" UNIQUE("username");
