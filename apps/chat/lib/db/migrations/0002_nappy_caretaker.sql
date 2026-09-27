ALTER TABLE "EveStoredFile" ADD COLUMN "storageKey" text;
UPDATE "EveStoredFile" SET "storageKey" = "key";
ALTER TABLE "EveStoredFile" ALTER COLUMN "storageKey" SET NOT NULL;
ALTER TABLE "EveStoredFile" ALTER COLUMN "storageKey" SET DEFAULT gen_random_uuid()::text;--> statement-breakpoint
ALTER TABLE "EveStoredFile" ADD CONSTRAINT "EveStoredFile_storageKey_unique" UNIQUE("storageKey");