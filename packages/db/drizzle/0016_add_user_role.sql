CREATE TYPE "app"."user_role" AS ENUM('member', 'admin');--> statement-breakpoint
ALTER TABLE "app"."user" ADD COLUMN "role" "app"."user_role" DEFAULT 'member' NOT NULL;