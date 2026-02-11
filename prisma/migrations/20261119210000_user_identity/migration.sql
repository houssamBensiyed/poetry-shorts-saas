-- Display name and avatar for the account UI.
ALTER TABLE "User"
  ADD COLUMN "name" VARCHAR(80),
  ADD COLUMN "avatar_url" TEXT;

-- Existing users keep a null name and get a deterministic built-in avatar in
-- the UI. No backfill is required.
