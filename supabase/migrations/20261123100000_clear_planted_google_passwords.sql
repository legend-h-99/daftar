-- Clear passwords planted on Google-created rows before #88 deployed (#93).
--
-- Before #88, email registration could store a password on a row that a Google sign-in had
-- created (googleId set, emailVerified false). If the owner later clicked a verification link,
-- the attacker's password became a working login.
--
-- Google has proven these rows' email addresses, so this applies the same change as the #82
-- link step: clear the password, consume pending verification links, and mark the email
-- verified. Owners keep Google sign-in and can set a password later through password reset.
-- Running it again is a no-op.
BEGIN;

UPDATE public."EmailVerification" ev
SET consumed = true
FROM public."User" u
WHERE ev."userId" = u.id
  AND ev.consumed = false
  AND u."googleId" IS NOT NULL
  AND u."passwordHash" IS NOT NULL
  AND u."emailVerified" IS NOT TRUE;

UPDATE public."User"
SET "passwordHash" = NULL, "emailVerified" = true
WHERE "googleId" IS NOT NULL
  AND "passwordHash" IS NOT NULL
  AND "emailVerified" IS NOT TRUE;

COMMIT;
