ALTER TABLE "EveChat" RENAME COLUMN "activeConversationId" TO "activeBranchId";--> statement-breakpoint
ALTER TABLE "EveConversation" RENAME COLUMN "parentConversationId" TO "parentBranchId";--> statement-breakpoint
ALTER TABLE "EveConversation" RENAME COLUMN "rootConversationId" TO "rootBranchId";--> statement-breakpoint
ALTER TABLE "EveDispatch" RENAME COLUMN "conversationId" TO "branchId";--> statement-breakpoint
ALTER TABLE "EveFileReference" RENAME COLUMN "conversationId" TO "branchId";--> statement-breakpoint
ALTER TABLE "EveResponseGroup" RENAME COLUMN "sourceConversationId" TO "sourceBranchId";--> statement-breakpoint
ALTER TABLE "EveSubagentSession" RENAME COLUMN "conversationId" TO "branchId";--> statement-breakpoint
ALTER TABLE "EveVote" RENAME COLUMN "conversationId" TO "branchId";--> statement-breakpoint
ALTER TABLE "EveSearchText" RENAME COLUMN "conversationId" TO "branchId";--> statement-breakpoint
ALTER TABLE "EveFileReference" RENAME CONSTRAINT "EveFileReference_conversationId_ownerId_EveConversation_id_ownerId_fk" TO "EveFileReference_branchId_ownerId_EveConversation_id_ownerId_fk";--> statement-breakpoint
ALTER TABLE "EveVote" RENAME CONSTRAINT "EveVote_conversationId_EveConversation_id_fk" TO "EveVote_branchId_EveConversation_id_fk";--> statement-breakpoint
ALTER TABLE "EveSearchText" RENAME CONSTRAINT "EveSearchText_conversationId_ownerId_EveConversation_id_ownerId_fk" TO "EveSearchText_branchId_ownerId_EveConversation_id_ownerId_fk";--> statement-breakpoint
ALTER TABLE "EveFileReference" RENAME CONSTRAINT "EveFileReference_conversationId_key_pk" TO "EveFileReference_branchId_key_pk";--> statement-breakpoint
ALTER TABLE "EveVote" RENAME CONSTRAINT "EveVote_conversationId_messageId_pk" TO "EveVote_branchId_messageId_pk";--> statement-breakpoint
ALTER TABLE "EveSearchText" RENAME CONSTRAINT "EveSearchText_conversationId_key_pk" TO "EveSearchText_branchId_key_pk";
