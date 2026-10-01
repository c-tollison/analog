CREATE TABLE "app"."reading_goal" (
	"user_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"target" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_goal_user_id_year_pk" PRIMARY KEY("user_id","year")
);
--> statement-breakpoint
ALTER TABLE "app"."reading_goal" ADD CONSTRAINT "reading_goal_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;