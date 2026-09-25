CREATE INDEX "user_name_trgm_idx" ON "app"."user" USING gin ("name" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "user_username_trgm_idx" ON "app"."user" USING gin ("username" gin_trgm_ops);