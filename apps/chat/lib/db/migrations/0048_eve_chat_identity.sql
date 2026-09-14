CREATE TABLE "EveChat" (
	"activeConversationId" uuid,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"isPinned" boolean DEFAULT false NOT NULL,
	"ownerId" text NOT NULL,
	"title" text NOT NULL,
	"titleStatus" text DEFAULT 'pending' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "EveChat_title_status" CHECK ("EveChat"."titleStatus" in ('pending', 'fallback', 'generated', 'manual'))
);
--> statement-breakpoint
ALTER TABLE "EveConversation" ADD COLUMN "chatId" uuid;
--> statement-breakpoint
CREATE TEMP TABLE "EveChatIdentityMap" (
	"ownerId" text NOT NULL,
	"rootId" uuid NOT NULL,
	"chatId" uuid NOT NULL,
	PRIMARY KEY ("ownerId", "rootId")
) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO "EveChatIdentityMap" ("ownerId", "rootId", "chatId")
SELECT DISTINCT ON (candidate."ownerId", coalesce(candidate."rootConversationId", candidate."id"))
	candidate."ownerId",
	coalesce(candidate."rootConversationId", candidate."id"),
	response_group."id"
FROM "EveResponseGroup" response_group
CROSS JOIN LATERAL unnest(response_group."candidateOperationIds") WITH ORDINALITY operation("operationId", ordinal)
INNER JOIN "EveConversation" candidate
	ON candidate."ownerId" = response_group."ownerId"
	AND candidate."operationId" = operation."operationId"
WHERE response_group."sourceConversationId" IS NULL
ORDER BY candidate."ownerId", coalesce(candidate."rootConversationId", candidate."id"), response_group."createdAt", response_group."id";
--> statement-breakpoint
INSERT INTO "EveChatIdentityMap" ("ownerId", "rootId", "chatId")
SELECT DISTINCT "ownerId", coalesce("rootConversationId", "id"), gen_random_uuid()
FROM "EveConversation"
ON CONFLICT ("ownerId", "rootId") DO NOTHING;
--> statement-breakpoint
UPDATE "EveConversation" conversation
SET "chatId" = identity."chatId"
FROM "EveChatIdentityMap" identity
WHERE identity."ownerId" = conversation."ownerId"
	AND identity."rootId" = coalesce(conversation."rootConversationId", conversation."id");
--> statement-breakpoint
INSERT INTO "EveChat" (
	"activeConversationId", "createdAt", "id", "isPinned", "ownerId", "title", "titleStatus", "updatedAt"
)
SELECT
	(array_agg(conversation."id" ORDER BY
		(conversation."state" = 'bound') DESC, conversation."createdAt", conversation."id"
	) FILTER (WHERE conversation."state" IN ('creating', 'bound', 'uncertain')))[1],
	min(conversation."createdAt"),
	conversation."chatId",
	bool_or(conversation."isPinned"),
	conversation."ownerId",
	(array_agg(coalesce(conversation."title", left(conversation."firstMessage", 100)) ORDER BY
		(conversation."title" IS NOT NULL) DESC,
		(conversation."rootConversationId" IS NULL) DESC,
		conversation."createdAt", conversation."id"
	))[1],
	CASE WHEN bool_or(conversation."title" IS NOT NULL) THEN 'manual' ELSE 'fallback' END,
	max(conversation."updatedAt")
FROM "EveConversation" conversation
GROUP BY conversation."chatId", conversation."ownerId";
--> statement-breakpoint
CREATE TABLE "EveChatProject" (
	"chatId" uuid PRIMARY KEY NOT NULL,
	"ownerId" text NOT NULL,
	"projectId" uuid NOT NULL
);
--> statement-breakpoint
INSERT INTO "EveChatProject" ("chatId", "ownerId", "projectId")
SELECT DISTINCT ON (conversation."chatId")
	conversation."chatId", assignment."ownerId", assignment."projectId"
FROM "EveConversationProject" assignment
INNER JOIN "EveConversation" conversation
	ON conversation."id" = assignment."conversationId"
	AND conversation."ownerId" = assignment."ownerId"
ORDER BY conversation."chatId", (conversation."rootConversationId" IS NULL) DESC, conversation."createdAt", conversation."id";
--> statement-breakpoint
DROP TABLE "EveConversationProject";
--> statement-breakpoint
ALTER TABLE "EveConversation" ALTER COLUMN "chatId" SET NOT NULL;
--> statement-breakpoint
ALTER TABLE "EveChat" ADD CONSTRAINT "EveChat_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "EveChat_id_owner" ON "EveChat" USING btree ("id","ownerId");
--> statement-breakpoint
CREATE INDEX "EveChat_owner_activity" ON "EveChat" USING btree ("ownerId","isPinned","updatedAt");
--> statement-breakpoint
CREATE UNIQUE INDEX "EveConversation_id_owner_chat" ON "EveConversation" USING btree ("id","ownerId","chatId");
--> statement-breakpoint
ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_parent_owner_fk";
--> statement-breakpoint
ALTER TABLE "EveConversation" DROP CONSTRAINT "EveConversation_root_owner_fk";
--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_chat_owner_fk" FOREIGN KEY ("chatId","ownerId") REFERENCES "public"."EveChat"("id","ownerId") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_parent_owner_fk" FOREIGN KEY ("parentConversationId","ownerId","chatId") REFERENCES "public"."EveConversation"("id","ownerId","chatId") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "EveConversation" ADD CONSTRAINT "EveConversation_root_owner_fk" FOREIGN KEY ("rootConversationId","ownerId","chatId") REFERENCES "public"."EveConversation"("id","ownerId","chatId") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "EveChatProject" ADD CONSTRAINT "EveChatProject_chatId_ownerId_EveChat_id_ownerId_fk" FOREIGN KEY ("chatId","ownerId") REFERENCES "public"."EveChat"("id","ownerId") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "EveChatProject" ADD CONSTRAINT "EveChatProject_projectId_ownerId_Project_id_userId_fk" FOREIGN KEY ("projectId","ownerId") REFERENCES "public"."Project"("id","userId") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "EveConversation_owner_chat" ON "EveConversation" USING btree ("ownerId","chatId");
--> statement-breakpoint
CREATE INDEX "EveChatProject_project" ON "EveChatProject" USING btree ("projectId");
--> statement-breakpoint
ALTER TABLE "EveConversation" DROP COLUMN "isPinned";
--> statement-breakpoint
ALTER TABLE "EveConversation" DROP COLUMN "title";
--> statement-breakpoint
ALTER TABLE "EveConversation" DROP COLUMN "updatedAt";
