CREATE TABLE "app"."collection_invite" (
	"collection_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"inviter_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_invite_collection_id_invitee_id_pk" PRIMARY KEY("collection_id","invitee_id")
);
--> statement-breakpoint
CREATE TABLE "app"."friend_request" (
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friend_request_sender_id_recipient_id_pk" PRIMARY KEY("sender_id","recipient_id")
);
--> statement-breakpoint
CREATE TABLE "app"."friendship" (
	"user_a_id" uuid NOT NULL,
	"user_b_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "friendship_user_a_id_user_b_id_pk" PRIMARY KEY("user_a_id","user_b_id"),
	CONSTRAINT "friendship_ordered_pair" CHECK ("app"."friendship"."user_a_id" < "app"."friendship"."user_b_id")
);
--> statement-breakpoint
ALTER TABLE "app"."collection_invite" ADD CONSTRAINT "collection_invite_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "app"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."collection_invite" ADD CONSTRAINT "collection_invite_invitee_id_user_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."collection_invite" ADD CONSTRAINT "collection_invite_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."friend_request" ADD CONSTRAINT "friend_request_sender_id_user_id_fk" FOREIGN KEY ("sender_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."friend_request" ADD CONSTRAINT "friend_request_recipient_id_user_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."friendship" ADD CONSTRAINT "friendship_user_a_id_user_id_fk" FOREIGN KEY ("user_a_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app"."friendship" ADD CONSTRAINT "friendship_user_b_id_user_id_fk" FOREIGN KEY ("user_b_id") REFERENCES "app"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_invite_invitee_id_idx" ON "app"."collection_invite" USING btree ("invitee_id");--> statement-breakpoint
CREATE INDEX "friend_request_recipient_id_idx" ON "app"."friend_request" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "friendship_user_b_id_idx" ON "app"."friendship" USING btree ("user_b_id");