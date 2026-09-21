-- Email verification is now required. Sign out anyone who signed up before it
-- was, so their next sign-in sends them a verification code.
DELETE FROM "app"."session"
WHERE "user_id" IN (SELECT "id" FROM "app"."user" WHERE "email_verified" = false);
