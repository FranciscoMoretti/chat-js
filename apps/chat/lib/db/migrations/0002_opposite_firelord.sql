CREATE TABLE "EveSearchText" (
	"conversationId" uuid NOT NULL,
	"ownerId" text NOT NULL,
	"key" text NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "EveSearchText_conversationId_key_pk" PRIMARY KEY("conversationId","key")
);
--> statement-breakpoint
ALTER TABLE "EveSearchText" ADD CONSTRAINT "EveSearchText_conversationId_ownerId_EveConversation_id_ownerId_fk" FOREIGN KEY ("conversationId","ownerId") REFERENCES "public"."EveConversation"("id","ownerId") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "EveSearchText_owner" ON "EveSearchText" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "EveSearchText_content" ON "EveSearchText" USING gin (to_tsvector('simple', "text"));--> statement-breakpoint
CREATE INDEX "EveChat_search_title" ON "EveChat" USING gin (to_tsvector('simple', "title"));