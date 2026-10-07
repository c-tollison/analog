CREATE TYPE "app"."audience" AS ENUM('children', 'young_adult', 'new_adult', 'adult', 'shonen', 'shoujo', 'seinen', 'josei');--> statement-breakpoint
CREATE TYPE "app"."edition_format" AS ENUM('paperback', 'hardcover', 'ebook', 'audiobook');--> statement-breakpoint
CREATE TYPE "app"."person_role" AS ENUM('author', 'illustrator', 'translator', 'editor', 'narrator', 'foreword', 'afterword', 'cover_artist');--> statement-breakpoint
-- Analog only tracks books, so kinds drop TV and film and gain graphic novels
-- and short story collections. Any TV or film rows become books.
ALTER TYPE "app"."series_kind" RENAME TO "series_kind_old";--> statement-breakpoint
CREATE TYPE "app"."series_kind" AS ENUM('manga', 'light_novel', 'book', 'graphic_novel', 'short_stories');--> statement-breakpoint
ALTER TABLE "app"."series" ALTER COLUMN "kind" SET DATA TYPE "app"."series_kind" USING (
	CASE WHEN "kind"::text IN ('tv', 'film') THEN 'book' ELSE "kind"::text END
)::"app"."series_kind";--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ALTER COLUMN "kind" SET DATA TYPE "app"."series_kind" USING (
	CASE WHEN "kind"::text IN ('tv', 'film') THEN 'book' ELSE "kind"::text END
)::"app"."series_kind";--> statement-breakpoint
DROP TYPE "app"."series_kind_old";--> statement-breakpoint
CREATE TABLE "app"."catalog_item_genre" (
	"catalog_item_id" uuid NOT NULL,
	"genre_slug" text NOT NULL,
	CONSTRAINT "catalog_item_genre_catalog_item_id_genre_slug_pk" PRIMARY KEY("catalog_item_id","genre_slug")
);
--> statement-breakpoint
CREATE TABLE "app"."catalog_item_isbn_person" (
	"isbn" text NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "app"."person_role" NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "catalog_item_isbn_person_isbn_person_id_role_pk" PRIMARY KEY("isbn","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "app"."catalog_item_person" (
	"catalog_item_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"role" "app"."person_role" NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "catalog_item_person_catalog_item_id_person_id_role_pk" PRIMARY KEY("catalog_item_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "app"."genre" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"parent_slug" text,
	"nonfiction" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."person" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"match_keys" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app"."publisher" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"aliases" text[] DEFAULT '{}' NOT NULL,
	"match_keys" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" ALTER COLUMN "format" SET DATA TYPE "app"."edition_format" USING (
	CASE
		WHEN lower("format") ~ 'audio' THEN 'audiobook'
		WHEN lower("format") ~ 'e-?book|kindle|epub|digital' THEN 'ebook'
		WHEN lower("format") ~ 'hard' AND lower("format") ~ 'pap|soft' THEN NULL
		WHEN lower("format") ~ 'hard' THEN 'hardcover'
		WHEN lower("format") ~ 'pap|soft|mass market|manga|comic|trade' THEN 'paperback'
	END
)::"app"."edition_format";--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" ADD COLUMN "edition_name" text;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" ADD COLUMN "publisher_id" uuid;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" ADD COLUMN "release_year" integer;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" ADD COLUMN "release_date" date;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" ADD COLUMN "page_count" integer;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" ADD COLUMN "goodreads_id" text;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD COLUMN "subtitle" text;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD COLUMN "first_published_year" integer;--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ADD COLUMN "audience" "app"."audience";--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "app"."series" ADD COLUMN "audience" "app"."audience";--> statement-breakpoint
ALTER TABLE "app"."catalog_item_genre" ADD CONSTRAINT "catalog_item_genre_catalog_item_id_catalog_item_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "app"."catalog_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_genre" ADD CONSTRAINT "catalog_item_genre_genre_slug_genre_slug_fk" FOREIGN KEY ("genre_slug") REFERENCES "app"."genre"("slug") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn_person" ADD CONSTRAINT "catalog_item_isbn_person_isbn_catalog_item_isbn_isbn_fk" FOREIGN KEY ("isbn") REFERENCES "app"."catalog_item_isbn"("isbn") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn_person" ADD CONSTRAINT "catalog_item_isbn_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "app"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_person" ADD CONSTRAINT "catalog_item_person_catalog_item_id_catalog_item_id_fk" FOREIGN KEY ("catalog_item_id") REFERENCES "app"."catalog_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."catalog_item_person" ADD CONSTRAINT "catalog_item_person_person_id_person_id_fk" FOREIGN KEY ("person_id") REFERENCES "app"."person"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."genre" ADD CONSTRAINT "genre_parent_slug_genre_slug_fk" FOREIGN KEY ("parent_slug") REFERENCES "app"."genre"("slug") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."publisher" ADD CONSTRAINT "publisher_parent_id_publisher_id_fk" FOREIGN KEY ("parent_id") REFERENCES "app"."publisher"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_item_genre_genre_slug_idx" ON "app"."catalog_item_genre" USING btree ("genre_slug");--> statement-breakpoint
CREATE INDEX "catalog_item_isbn_person_person_id_idx" ON "app"."catalog_item_isbn_person" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "catalog_item_person_person_id_idx" ON "app"."catalog_item_person" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "genre_parent_slug_idx" ON "app"."genre" USING btree ("parent_slug");--> statement-breakpoint
CREATE INDEX "person_match_keys_idx" ON "app"."person" USING gin ("match_keys");--> statement-breakpoint
CREATE INDEX "publisher_match_keys_idx" ON "app"."publisher" USING gin ("match_keys");--> statement-breakpoint
CREATE INDEX "publisher_parent_id_idx" ON "app"."publisher" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" ADD CONSTRAINT "catalog_item_isbn_publisher_id_publisher_id_fk" FOREIGN KEY ("publisher_id") REFERENCES "app"."publisher"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_item_isbn_publisher_id_idx" ON "app"."catalog_item_isbn" USING btree ("publisher_id");--> statement-breakpoint
-- The genre list. Subgenres name their parent, so filtering by a genre can
-- include them.
INSERT INTO "app"."genre" ("slug", "name", "parent_slug", "nonfiction") VALUES
	('action-adventure', 'Action & adventure', NULL, false),
	('alternate-history', 'Alternate history', NULL, false),
	('bildungsroman', 'Bildungsroman', NULL, false),
	('classics', 'Classics', NULL, false),
	('coming-of-age', 'Coming of age', NULL, false),
	('contemporary-fiction', 'Contemporary fiction', NULL, false),
	('dystopian', 'Dystopian', NULL, false),
	('family-drama', 'Family drama', NULL, false),
	('fantasy', 'Fantasy', NULL, false),
	('dark-fantasy', 'Dark fantasy', 'fantasy', false),
	('fairy-tales', 'Fairy tales', 'fantasy', false),
	('folktales', 'Folktales', 'fantasy', false),
	('heroic-fantasy', 'Heroic fantasy', 'fantasy', false),
	('high-fantasy', 'High fantasy', 'fantasy', false),
	('historical-fantasy', 'Historical fantasy', 'fantasy', false),
	('low-fantasy', 'Low fantasy', 'fantasy', false),
	('magical-realism', 'Magical realism', 'fantasy', false),
	('mythic-fantasy', 'Mythic fantasy', 'fantasy', false),
	('urban-fantasy', 'Urban fantasy', 'fantasy', false),
	('historical-fiction', 'Historical fiction', NULL, false),
	('horror', 'Horror', NULL, false),
	('body-horror', 'Body horror', 'horror', false),
	('comedy-horror', 'Comedy horror', 'horror', false),
	('gothic-horror', 'Gothic horror', 'horror', false),
	('cosmic-horror', 'Cosmic horror', 'horror', false),
	('paranormal-horror', 'Paranormal horror', 'horror', false),
	('post-apocalyptic-horror', 'Post-apocalyptic horror', 'horror', false),
	('psychological-horror', 'Psychological horror', 'horror', false),
	('quiet-horror', 'Quiet horror', 'horror', false),
	('slasher', 'Slasher', 'horror', false),
	('lgbtq', 'LGBTQ+', NULL, false),
	('literary-fiction', 'Literary fiction', NULL, false),
	('mystery', 'Mystery', NULL, false),
	('caper', 'Caper', 'mystery', false),
	('cozy-mystery', 'Cozy mystery', 'mystery', false),
	('detective-mystery', 'Detective mystery', 'mystery', false),
	('historical-mystery', 'Historical mystery', 'mystery', false),
	('howdunit', 'Howdunit', 'mystery', false),
	('locked-room-mystery', 'Locked room mystery', 'mystery', false),
	('noir', 'Noir', 'mystery', false),
	('procedural-mystery', 'Procedural mystery', 'mystery', false),
	('supernatural-mystery', 'Supernatural mystery', 'mystery', false),
	('urban-fiction', 'Urban fiction', NULL, false),
	('romance', 'Romance', NULL, false),
	('contemporary-romance', 'Contemporary romance', 'romance', false),
	('dark-romance', 'Dark romance', 'romance', false),
	('erotic-romance', 'Erotic romance', 'romance', false),
	('romantasy', 'Romantasy', 'romance', false),
	('gothic-romance', 'Gothic romance', 'romance', false),
	('historical-romance', 'Historical romance', 'romance', false),
	('paranormal-romance', 'Paranormal romance', 'romance', false),
	('regency-romance', 'Regency', 'romance', false),
	('romantic-comedy', 'Romantic comedy', 'romance', false),
	('romantic-suspense', 'Romantic suspense', 'romance', false),
	('sci-fi-romance', 'Sci-fi romance', 'romance', false),
	('satire', 'Satire', NULL, false),
	('science-fiction', 'Science fiction', NULL, false),
	('apocalyptic-sci-fi', 'Apocalyptic sci-fi', 'science-fiction', false),
	('colonization-sci-fi', 'Colonization sci-fi', 'science-fiction', false),
	('hard-sci-fi', 'Hard sci-fi', 'science-fiction', false),
	('military-sci-fi', 'Military sci-fi', 'science-fiction', false),
	('mind-uploading', 'Mind uploading', 'science-fiction', false),
	('parallel-worlds', 'Parallel worlds', 'science-fiction', false),
	('soft-sci-fi', 'Soft sci-fi', 'science-fiction', false),
	('space-opera', 'Space opera', 'science-fiction', false),
	('space-western', 'Space western', 'science-fiction', false),
	('steampunk', 'Steampunk', 'science-fiction', false),
	('speculative-fiction', 'Speculative fiction', NULL, false),
	('sports-fiction', 'Sports', NULL, false),
	('thriller', 'Thriller', NULL, false),
	('action-thriller', 'Action thriller', 'thriller', false),
	('conspiracy-thriller', 'Conspiracy thriller', 'thriller', false),
	('disaster-thriller', 'Disaster thriller', 'thriller', false),
	('espionage-thriller', 'Espionage thriller', 'thriller', false),
	('forensic-thriller', 'Forensic thriller', 'thriller', false),
	('historical-thriller', 'Historical thriller', 'thriller', false),
	('legal-thriller', 'Legal thriller', 'thriller', false),
	('paranormal-thriller', 'Paranormal thriller', 'thriller', false),
	('psychological-thriller', 'Psychological thriller', 'thriller', false),
	('religious-thriller', 'Religious thriller', 'thriller', false),
	('utopian', 'Utopian', NULL, false),
	('war-fiction', 'War', NULL, false),
	('western', 'Western', NULL, false),
	('womens-fiction', 'Women''s fiction', NULL, false),
	('comedy', 'Comedy', NULL, false),
	('drama', 'Drama', NULL, false),
	('isekai', 'Isekai', NULL, false),
	('mahou-shoujo', 'Mahou shoujo', NULL, false),
	('mecha', 'Mecha', NULL, false),
	('music', 'Music', NULL, false),
	('psychological', 'Psychological', NULL, false),
	('slice-of-life', 'Slice of life', NULL, false),
	('supernatural', 'Supernatural', NULL, false),
	('art-photography', 'Art & photography', NULL, true),
	('memoir', 'Memoir & autobiography', NULL, true),
	('biography', 'Biography', NULL, true),
	('essays', 'Essays', NULL, true),
	('food-drink', 'Food & drink', NULL, true),
	('history', 'History', NULL, true),
	('how-to', 'How-to & guides', NULL, true),
	('humanities', 'Humanities & social sciences', NULL, true),
	('humor', 'Humor', NULL, true),
	('parenting', 'Parenting', NULL, true),
	('philosophy', 'Philosophy', NULL, true),
	('religion', 'Religion & spirituality', NULL, true),
	('science-technology', 'Science & technology', NULL, true),
	('self-help', 'Self-help', NULL, true),
	('travel', 'Travel', NULL, true),
	('true-crime', 'True crime', NULL, true);--> statement-breakpoint
-- Moves each book's metadata into the new columns. Rules for formats,
-- genres and names match apps/api/src/lib/book-values.ts.
UPDATE "app"."catalog_item" SET
	"subtitle" = nullif(trim("metadata"->>'subtitle'), ''),
	"description" = nullif(trim("metadata"->>'description'), ''),
	"first_published_year" = CASE
		WHEN "metadata"->>'firstPublishYear' ~ '^[0-9]{1,4}$' THEN ("metadata"->>'firstPublishYear')::int
	END;--> statement-breakpoint
INSERT INTO "app"."catalog_item_genre" ("catalog_item_id", "genre_slug")
SELECT DISTINCT ci."id", m."slug"
FROM "app"."catalog_item" ci
CROSS JOIN LATERAL jsonb_array_elements_text(ci."metadata"->'genres') g("name")
CROSS JOIN LATERAL regexp_split_to_table(g."name", '\s*/\s*') p("part")
JOIN (VALUES
		('action-adventure', '(^|[^a-z])action([^a-z]|$)|adventure'),
		('alternate-history', 'alternat(iv)?e history'),
		('bildungsroman', 'bildungsroman'),
		('classics', 'classics'),
		('coming-of-age', 'coming of age'),
		('contemporary-fiction', '^contemporary( fiction)?$'),
		('dystopian', 'dystopia'),
		('family-drama', 'family (life|saga|drama)'),
		('fantasy', 'fantasy'),
		('dark-fantasy', 'dark fantasy'),
		('fairy-tales', 'fairy ?tale'),
		('folktales', 'folk ?tale|folklore'),
		('heroic-fantasy', 'heroic fantasy|sword (and|&) sorcery'),
		('high-fantasy', '^epic$|high fantasy|epic fantasy'),
		('historical-fantasy', 'historical fantasy'),
		('low-fantasy', 'low fantasy'),
		('magical-realism', 'magical realism'),
		('mythic-fantasy', 'mytholog|mythic'),
		('urban-fantasy', 'urban fantasy'),
		('historical-fiction', '^historical( fiction)?$'),
		('horror', 'horror'),
		('body-horror', 'body horror'),
		('comedy-horror', 'comedy horror|horror comedy'),
		('gothic-horror', 'gothic horror|^gothic$'),
		('cosmic-horror', 'cosmic horror|lovecraft'),
		('paranormal-horror', 'paranormal horror|haunt'),
		('post-apocalyptic-horror', 'zombie'),
		('psychological-horror', 'psychological horror'),
		('quiet-horror', 'quiet horror'),
		('slasher', 'slasher'),
		('lgbtq', 'lgbt|gay|lesbian|queer'),
		('literary-fiction', 'literary'),
		('mystery', 'myster|detective'),
		('caper', 'caper|heist'),
		('cozy-mystery', 'cozy'),
		('detective-mystery', 'detective|private investigator|amateur sleuth'),
		('historical-mystery', 'historical myster'),
		('howdunit', 'howdunn?it'),
		('locked-room-mystery', 'locked room'),
		('noir', '(^|[^a-z])noir([^a-z]|$)'),
		('procedural-mystery', 'police procedural|hard.boiled'),
		('supernatural-mystery', 'supernatural myster'),
		('urban-fiction', 'urban fiction|street lit|^urban$'),
		('romance', 'romance|love stor'),
		('contemporary-romance', 'contemporary romance'),
		('dark-romance', 'dark romance'),
		('erotic-romance', 'erotic'),
		('romantasy', 'romantasy|fantasy romance'),
		('gothic-romance', 'gothic romance'),
		('historical-romance', 'historical romance'),
		('paranormal-romance', 'paranormal romance'),
		('regency-romance', 'regency'),
		('romantic-comedy', 'romantic comed|rom.?com'),
		('romantic-suspense', 'romantic suspense'),
		('sci-fi-romance', 'sci.?fi romance|science fiction romance'),
		('satire', 'satire'),
		('science-fiction', 'science fiction|sci.?fi'),
		('apocalyptic-sci-fi', 'apocalyptic'),
		('colonization-sci-fi', 'coloniz'),
		('hard-sci-fi', 'hard science'),
		('military-sci-fi', 'military science'),
		('mind-uploading', 'mind upload|cyberpunk|android'),
		('parallel-worlds', 'parallel (world|universe)|alternate (world|universe)'),
		('soft-sci-fi', 'soft science'),
		('space-opera', 'space opera'),
		('space-western', 'space western'),
		('steampunk', 'steampunk'),
		('speculative-fiction', 'speculative'),
		('sports-fiction', '(^|[^a-z])sports?([^a-z]|$)'),
		('thriller', 'thriller|suspense'),
		('action-thriller', 'action thriller'),
		('conspiracy-thriller', 'conspirac'),
		('disaster-thriller', 'disaster'),
		('espionage-thriller', 'espionage|spies|spy'),
		('forensic-thriller', 'forensic'),
		('historical-thriller', 'historical thriller'),
		('legal-thriller', 'legal thriller|^legal$'),
		('paranormal-thriller', 'paranormal thriller'),
		('psychological-thriller', 'psychological thriller'),
		('religious-thriller', 'religious thriller'),
		('utopian', 'utopia'),
		('war-fiction', '(^|[^a-z])war([^a-z]|$)|military'),
		('western', 'western'),
		('womens-fiction', 'women''?s fiction'),
		('comedy', 'comedy|humorous'),
		('drama', '(^|[^a-z])drama([^a-z]|$)'),
		('isekai', 'isekai'),
		('mahou-shoujo', 'mahou|magical girl'),
		('mecha', 'mecha'),
		('music', 'music'),
		('psychological', 'psychological'),
		('slice-of-life', 'slice.of.life|school life'),
		('supernatural', 'supernatural|paranormal|ghost|occult|vampire|demon'),
		('art-photography', '^art( |$)|photography|architecture|film & video|design'),
		('memoir', 'memoir|autobiograph'),
		('biography', 'biograph'),
		('essays', 'essays'),
		('food-drink', 'cooking|cookbook|cookery|food|wine|beverage'),
		('history', '^history'),
		('how-to', 'crafts|hobbies|how.to|reference|games & activities'),
		('humanities', 'social science|political science|anthropology|sociology|psychology'),
		('humor', '^humor'),
		('parenting', 'parenting'),
		('philosophy', 'philosophy'),
		('religion', 'religio|spiritual'),
		('science-technology', '^science$|technology|computers|mathematics|nature|medical'),
		('self-help', 'self.help|personal growth'),
		('travel', '^travel'),
		('true-crime', 'true crime')
	) m("slug", "pattern") ON p."part" ~* m."pattern"
WHERE jsonb_typeof(ci."metadata"->'genres') = 'array';--> statement-breakpoint
-- Who a book is for, from source genres like "Young Adult Fiction".
UPDATE "app"."catalog_item" ci SET "audience" = (
	SELECT m."audience"::"app"."audience"
	FROM jsonb_array_elements_text(ci."metadata"->'genres') g("name")
	JOIN (VALUES
		('children', 'juvenile|children'),
		('young_adult', 'young adult'),
		('new_adult', 'new adult')
	) m("audience", "pattern") ON g."name" ~* m."pattern"
	LIMIT 1
)
WHERE jsonb_typeof(ci."metadata"->'genres') = 'array';--> statement-breakpoint
-- Volumes of a series linked to a source, like AniList, take its genres
-- when they have none of their own.
INSERT INTO "app"."catalog_item_genre" ("catalog_item_id", "genre_slug")
SELECT DISTINCT ci."id", m."slug"
FROM "app"."series" se
JOIN "app"."catalog_item" ci ON ci."series_id" = se."id"
CROSS JOIN LATERAL jsonb_array_elements_text(se."details"->'genres') g("name")
CROSS JOIN LATERAL regexp_split_to_table(g."name", '\s*/\s*') p("part")
JOIN (VALUES
		('action-adventure', '(^|[^a-z])action([^a-z]|$)|adventure'),
		('alternate-history', 'alternat(iv)?e history'),
		('bildungsroman', 'bildungsroman'),
		('classics', 'classics'),
		('coming-of-age', 'coming of age'),
		('contemporary-fiction', '^contemporary( fiction)?$'),
		('dystopian', 'dystopia'),
		('family-drama', 'family (life|saga|drama)'),
		('fantasy', 'fantasy'),
		('dark-fantasy', 'dark fantasy'),
		('fairy-tales', 'fairy ?tale'),
		('folktales', 'folk ?tale|folklore'),
		('heroic-fantasy', 'heroic fantasy|sword (and|&) sorcery'),
		('high-fantasy', '^epic$|high fantasy|epic fantasy'),
		('historical-fantasy', 'historical fantasy'),
		('low-fantasy', 'low fantasy'),
		('magical-realism', 'magical realism'),
		('mythic-fantasy', 'mytholog|mythic'),
		('urban-fantasy', 'urban fantasy'),
		('historical-fiction', '^historical( fiction)?$'),
		('horror', 'horror'),
		('body-horror', 'body horror'),
		('comedy-horror', 'comedy horror|horror comedy'),
		('gothic-horror', 'gothic horror|^gothic$'),
		('cosmic-horror', 'cosmic horror|lovecraft'),
		('paranormal-horror', 'paranormal horror|haunt'),
		('post-apocalyptic-horror', 'zombie'),
		('psychological-horror', 'psychological horror'),
		('quiet-horror', 'quiet horror'),
		('slasher', 'slasher'),
		('lgbtq', 'lgbt|gay|lesbian|queer'),
		('literary-fiction', 'literary'),
		('mystery', 'myster|detective'),
		('caper', 'caper|heist'),
		('cozy-mystery', 'cozy'),
		('detective-mystery', 'detective|private investigator|amateur sleuth'),
		('historical-mystery', 'historical myster'),
		('howdunit', 'howdunn?it'),
		('locked-room-mystery', 'locked room'),
		('noir', '(^|[^a-z])noir([^a-z]|$)'),
		('procedural-mystery', 'police procedural|hard.boiled'),
		('supernatural-mystery', 'supernatural myster'),
		('urban-fiction', 'urban fiction|street lit|^urban$'),
		('romance', 'romance|love stor'),
		('contemporary-romance', 'contemporary romance'),
		('dark-romance', 'dark romance'),
		('erotic-romance', 'erotic'),
		('romantasy', 'romantasy|fantasy romance'),
		('gothic-romance', 'gothic romance'),
		('historical-romance', 'historical romance'),
		('paranormal-romance', 'paranormal romance'),
		('regency-romance', 'regency'),
		('romantic-comedy', 'romantic comed|rom.?com'),
		('romantic-suspense', 'romantic suspense'),
		('sci-fi-romance', 'sci.?fi romance|science fiction romance'),
		('satire', 'satire'),
		('science-fiction', 'science fiction|sci.?fi'),
		('apocalyptic-sci-fi', 'apocalyptic'),
		('colonization-sci-fi', 'coloniz'),
		('hard-sci-fi', 'hard science'),
		('military-sci-fi', 'military science'),
		('mind-uploading', 'mind upload|cyberpunk|android'),
		('parallel-worlds', 'parallel (world|universe)|alternate (world|universe)'),
		('soft-sci-fi', 'soft science'),
		('space-opera', 'space opera'),
		('space-western', 'space western'),
		('steampunk', 'steampunk'),
		('speculative-fiction', 'speculative'),
		('sports-fiction', '(^|[^a-z])sports?([^a-z]|$)'),
		('thriller', 'thriller|suspense'),
		('action-thriller', 'action thriller'),
		('conspiracy-thriller', 'conspirac'),
		('disaster-thriller', 'disaster'),
		('espionage-thriller', 'espionage|spies|spy'),
		('forensic-thriller', 'forensic'),
		('historical-thriller', 'historical thriller'),
		('legal-thriller', 'legal thriller|^legal$'),
		('paranormal-thriller', 'paranormal thriller'),
		('psychological-thriller', 'psychological thriller'),
		('religious-thriller', 'religious thriller'),
		('utopian', 'utopia'),
		('war-fiction', '(^|[^a-z])war([^a-z]|$)|military'),
		('western', 'western'),
		('womens-fiction', 'women''?s fiction'),
		('comedy', 'comedy|humorous'),
		('drama', '(^|[^a-z])drama([^a-z]|$)'),
		('isekai', 'isekai'),
		('mahou-shoujo', 'mahou|magical girl'),
		('mecha', 'mecha'),
		('music', 'music'),
		('psychological', 'psychological'),
		('slice-of-life', 'slice.of.life|school life'),
		('supernatural', 'supernatural|paranormal|ghost|occult|vampire|demon'),
		('art-photography', '^art( |$)|photography|architecture|film & video|design'),
		('memoir', 'memoir|autobiograph'),
		('biography', 'biograph'),
		('essays', 'essays'),
		('food-drink', 'cooking|cookbook|cookery|food|wine|beverage'),
		('history', '^history'),
		('how-to', 'crafts|hobbies|how.to|reference|games & activities'),
		('humanities', 'social science|political science|anthropology|sociology|psychology'),
		('humor', '^humor'),
		('parenting', 'parenting'),
		('philosophy', 'philosophy'),
		('religion', 'religio|spiritual'),
		('science-technology', '^science$|technology|computers|mathematics|nature|medical'),
		('self-help', 'self.help|personal growth'),
		('travel', '^travel'),
		('true-crime', 'true crime')
	) m("slug", "pattern") ON p."part" ~* m."pattern"
WHERE jsonb_typeof(se."details"->'genres') = 'array'
	AND NOT EXISTS (
		SELECT 1 FROM "app"."catalog_item_genre" own WHERE own."catalog_item_id" = ci."id"
	);--> statement-breakpoint
-- A linked series starts with its source's description.
UPDATE "app"."series"
SET "description" = nullif(trim("details"->>'description'), '');--> statement-breakpoint
-- Only the main ISBN's facts were on file, in the item's metadata. A date
-- known only by its year was stored as January 1.
UPDATE "app"."catalog_item_isbn" i SET
	"publisher" = coalesce(i."publisher", ci."metadata"->'publishers'->>0),
	"edition_name" = nullif(trim(ci."metadata"->>'editionName'), ''),
	"release_year" = extract(year FROM ci."release_date")::int,
	"release_date" = CASE
		WHEN to_char(ci."release_date", 'MM-DD') <> '01-01' THEN ci."release_date"
	END,
	"page_count" = CASE
		WHEN ci."metadata"->>'pageCount' ~ '^[0-9]{1,6}$' THEN (ci."metadata"->>'pageCount')::int
	END,
	"goodreads_id" = CASE
		WHEN ci."metadata"->>'goodreadsId' ~ '^[0-9]+$' THEN ci."metadata"->>'goodreadsId'
	END
FROM "app"."catalog_item" ci
WHERE i."catalog_item_id" = ci."id" AND i."main";--> statement-breakpoint
-- One publisher per spelling that matches. It's named after its most used
-- spelling, skipping ones with "LLC" or a lowercase start.
INSERT INTO "app"."publisher" ("name", "aliases", "match_keys")
SELECT
	(array_agg(s."name" ORDER BY (s."name" ~* '\m(llc|inc|incorporated|ltd)\M' OR s."name" ~ '^[[:lower:]]'), s."uses" DESC, s."name"))[1],
	coalesce((array_agg(s."name" ORDER BY (s."name" ~* '\m(llc|inc|incorporated|ltd)\M' OR s."name" ~ '^[[:lower:]]'), s."uses" DESC, s."name"))[2:], '{}'),
	ARRAY[s."key"]
FROM (
	SELECT trim("publisher") AS "name", regexp_replace(regexp_replace(lower(normalize("publisher", NFKC)), '\m(llc|inc|incorporated|ltd)\M', '', 'g'), '[^[:alnum:]]+', '', 'g') AS "key", count(*) AS "uses"
	FROM "app"."catalog_item_isbn"
	WHERE "publisher" IS NOT NULL
	GROUP BY 1, 2
) s
WHERE s."key" <> ''
GROUP BY s."key";--> statement-breakpoint
UPDATE "app"."catalog_item_isbn" i SET "publisher_id" = p."id"
FROM "app"."publisher" p
WHERE i."publisher" IS NOT NULL AND p."match_keys" @> ARRAY[regexp_replace(regexp_replace(lower(normalize(i."publisher", NFKC)), '\m(llc|inc|incorporated|ltd)\M', '', 'g'), '[^[:alnum:]]+', '', 'g')];--> statement-breakpoint
-- Authors become people, credited on the work.
INSERT INTO "app"."person" ("name", "aliases", "match_keys")
SELECT
	(array_agg(s."name" ORDER BY (s."name" ~* '\m(llc|inc|incorporated|ltd)\M' OR s."name" ~ '^[[:lower:]]'), s."uses" DESC, s."name"))[1],
	coalesce((array_agg(s."name" ORDER BY (s."name" ~* '\m(llc|inc|incorporated|ltd)\M' OR s."name" ~ '^[[:lower:]]'), s."uses" DESC, s."name"))[2:], '{}'),
	ARRAY[s."key"]
FROM (
	SELECT trim(a."name") AS "name", regexp_replace(regexp_replace(lower(normalize(a."name", NFKC)), '\m(llc|inc|incorporated|ltd)\M', '', 'g'), '[^[:alnum:]]+', '', 'g') AS "key", count(*) AS "uses"
	FROM "app"."catalog_item" ci
	CROSS JOIN LATERAL jsonb_array_elements_text(ci."metadata"->'authors') a("name")
	WHERE jsonb_typeof(ci."metadata"->'authors') = 'array'
	GROUP BY 1, 2
) s
WHERE s."key" <> ''
GROUP BY s."key";--> statement-breakpoint
INSERT INTO "app"."catalog_item_person" ("catalog_item_id", "person_id", "role", "position")
SELECT ci."id", p."id", 'author', min(a."ord")::int - 1
FROM "app"."catalog_item" ci
CROSS JOIN LATERAL jsonb_array_elements_text(ci."metadata"->'authors') WITH ORDINALITY a("name", "ord")
JOIN "app"."person" p ON p."match_keys" @> ARRAY[regexp_replace(regexp_replace(lower(normalize(a."name", NFKC)), '\m(llc|inc|incorporated|ltd)\M', '', 'g'), '[^[:alnum:]]+', '', 'g')]
WHERE jsonb_typeof(ci."metadata"->'authors') = 'array'
GROUP BY ci."id", p."id";--> statement-breakpoint
ALTER TABLE "app"."catalog_item_isbn" DROP COLUMN "publisher";--> statement-breakpoint
ALTER TABLE "app"."catalog_item" DROP COLUMN "release_date";--> statement-breakpoint
ALTER TABLE "app"."catalog_item" DROP COLUMN "metadata";--> statement-breakpoint
ALTER TABLE "app"."catalog_item" DROP COLUMN "format";--> statement-breakpoint
DROP TYPE "app"."media_format";--> statement-breakpoint
-- Series no longer link to outside sources like AniList. Their description
-- and genres were copied above.
ALTER TABLE "app"."series" DROP CONSTRAINT "series_external_unique";--> statement-breakpoint
ALTER TABLE "app"."series" DROP COLUMN "external_source";--> statement-breakpoint
ALTER TABLE "app"."series" DROP COLUMN "external_id";--> statement-breakpoint
ALTER TABLE "app"."series" DROP COLUMN "details_source";--> statement-breakpoint
ALTER TABLE "app"."series" DROP COLUMN "details_id";--> statement-breakpoint
ALTER TABLE "app"."series" DROP COLUMN "details";--> statement-breakpoint
ALTER TABLE "app"."series" DROP COLUMN "details_fetched_at";--> statement-breakpoint
ALTER TYPE "app"."external_source" RENAME TO "external_source_old";--> statement-breakpoint
CREATE TYPE "app"."external_source" AS ENUM('openlibrary', 'googlebooks');--> statement-breakpoint
ALTER TABLE "app"."catalog_item" ALTER COLUMN "external_source" SET DATA TYPE "app"."external_source" USING (
	CASE WHEN "external_source"::text IN ('openlibrary', 'googlebooks') THEN "external_source"::text END
)::"app"."external_source";--> statement-breakpoint
DROP TYPE "app"."external_source_old";
