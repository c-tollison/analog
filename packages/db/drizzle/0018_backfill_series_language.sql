-- Sets each series' language from its books' languages, when all of them
-- agree. Series with no known language, or mixed ones, stay empty.
UPDATE "app"."series" AS "s"
SET "language" = "l"."code"
FROM (
    SELECT "c"."series_id", min("m"."code") AS "code"
    FROM "app"."catalog_item" AS "c"
    CROSS JOIN LATERAL jsonb_array_elements_text(
        CASE
            WHEN jsonb_typeof("c"."metadata" -> 'languages') = 'array'
                THEN "c"."metadata" -> 'languages'
            ELSE '[]'::jsonb
        END
    ) AS "lang"("name")
    JOIN (
        VALUES
            ('English', 'en'),
            ('Japanese', 'ja'),
            ('Korean', 'ko'),
            ('Chinese', 'zh'),
            ('French', 'fr'),
            ('Spanish', 'es'),
            ('German', 'de'),
            ('Italian', 'it'),
            ('Portuguese', 'pt')
    ) AS "m"("name", "code") ON "m"."name" = "lang"."name"
    WHERE "c"."series_id" IS NOT NULL
    GROUP BY "c"."series_id"
    HAVING count(DISTINCT "m"."code") = 1
) AS "l"
WHERE "s"."id" = "l"."series_id" AND "s"."language" IS NULL;
