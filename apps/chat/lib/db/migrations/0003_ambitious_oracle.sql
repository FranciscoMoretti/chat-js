ALTER TABLE "EveDocumentRevision" ADD COLUMN "fileIds" jsonb DEFAULT '[]'::jsonb NOT NULL;
--> statement-breakpoint
-- Populate persisted revisions once; new writes use explicit IDs, never content scanning.
WITH referenced_files AS (
  SELECT revision."id", jsonb_agg(DISTINCT file."key" ORDER BY file."key") AS "fileIds"
  FROM "EveDocumentRevision" revision
  CROSS JOIN LATERAL regexp_matches(
    revision."content",
    '/api/files/([A-Za-z0-9_-]{24}(?:\.[a-z0-9]{1,10})?)(?![A-Za-z0-9_/-])',
    'g'
  ) AS matched
  JOIN "EveStoredFile" file ON file."key" = matched[1]
    AND file."ownerId" = revision."ownerId" AND file."state" = 'active'
  GROUP BY revision."id"
)
UPDATE "EveDocumentRevision" revision
SET "fileIds" = referenced_files."fileIds"
FROM referenced_files WHERE revision."id" = referenced_files."id";
--> statement-breakpoint
INSERT INTO "EveFileReference" ("conversationId", "key", "ownerId")
SELECT DISTINCT revision."conversationId", file_id, revision."ownerId"
FROM "EveDocumentRevision" revision,
  jsonb_array_elements_text(revision."fileIds") AS file_id
ON CONFLICT DO NOTHING;
