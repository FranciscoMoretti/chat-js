import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/eve/search-text";
import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { z } from "zod";

import { getAccessibleEveDocument } from "@/lib/db/eve-documents";
import {
  getEveChatIdentity,
  listEveConversationBranches,
  listEveConversations,
  updateEveConversationMetadata,
} from "@/lib/db/eve-queries";
import { searchEveConversations } from "@/lib/db/eve-search";
import {
  assignEveConversationProject,
  getEveMessageVotes,
  getEveFollowup,
} from "@/lib/db/queries";
import { eveHistoryInput } from "@/lib/eve/history-input";
import { eveManualDocumentInput } from "@/lib/eve/document-contracts";

import { resolveEvePrincipal } from "@/lib/eve/principal";
import { restoreMessageAttachments } from "@/lib/eve/restore-message-attachments";
import { saveManualEveDocument } from "@/lib/eve/save-document";

import { voteEveMessage } from "@/lib/eve/vote-message";

import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/trpc/init";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const MAX_CONVERSATION_TITLE_LENGTH = 255;
const MAX_MESSAGE_ID_LENGTH = 512;
const MAX_OWNER_SCOPE_LENGTH = 128;

const eveProcedure = protectedProcedure;

const eveOwnedProcedure = publicProcedure.use(
  async ({
    ctx,
    next,
  }: Readonly<
    Pick<
      Parameters<(typeof publicProcedure)["_def"]["middlewares"][0]>[0],
      "next"
    >
  > & { readonly ctx: { readonly user?: { readonly id: string } | null } }) => {
    let ownerId = ctx.user?.id;
    if (typeof ownerId !== "string" || ownerId === "") {
      const principal = await resolveEvePrincipal(await headers());
      ownerId = principal?.ownerId;
    }
    if (typeof ownerId !== "string" || ownerId === "") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return await next({ ctx: { eveOwnerId: ownerId } });
  }
);

export const eveRouter = createTRPCRouter({
  followup: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        eventId: z.string().min(1).max(512),
      })
    )
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: {
          readonly conversationId: string;
          readonly eventId: string;
        };
      }) =>
        await getEveFollowup(
          ctx.eveOwnerId,
          input.conversationId,
          input.eventId
        )
    ),
  assignProject: eveProcedure
    .input(
      z.object({ conversationId: z.uuid(), projectId: z.uuid().nullable() })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{
          conversationId: string;
          projectId: string | null;
        }>;
      }) => {
        const assigned = await assignEveConversationProject(
          ctx.user.id,
          input.conversationId,
          input.projectId
        );
        if (!assigned) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Conversation or project not found.",
          });
        }
        return assigned;
      }
    ),
  branches: eveOwnedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: { readonly id: string };
      }) => {
        const family = await listEveConversationBranches(
          ctx.eveOwnerId,
          input.id
        );
        if (!family) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return family;
      }
    ),
  document: publicProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        documentId: z.uuid(),
        revisionId: z.uuid().optional(),
      })
    )
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user?: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{
          conversationId: string;
          documentId: string;
          revisionId?: string | undefined;
        }>;
      }) => {
        let ownerId = ctx.user?.id;
        if (typeof ownerId !== "string" || ownerId === "") {
          const principal = await resolveEvePrincipal(await headers());
          ownerId = principal?.ownerId;
        }
        const document = await getAccessibleEveDocument(
          ownerId,
          input.conversationId,
          input.documentId,
          input.revisionId
        );
        if (!document) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return document;
      }
    ),
  get: eveOwnedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: { readonly id: string };
      }) => {
        const row = await getEveChatIdentity(ctx.eveOwnerId, input.id);
        if (row === undefined) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return row;
      }
    ),
  list: eveOwnedProcedure.input(eveHistoryInput).query(
    async ({
      ctx,
      input,
    }: {
      readonly ctx: { readonly eveOwnerId: string };
      readonly input: ReadonlyNativeSurface<{
        search: string;
        cursor?:
          | { id: string; isPinned: boolean; updatedAt: string }
          | null
          | undefined;
        ownerScope?: string | undefined;
        projectId?: string | null | undefined;
      }>;
    }) => {
      const { ownerScope } = input;
      if (
        typeof ownerScope === "string" &&
        ownerScope !== "" &&
        input.ownerScope !== ctx.eveOwnerId
      ) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await listEveConversations(ctx.eveOwnerId, input);
    }
  ),
  pin: eveOwnedProcedure
    .input(z.object({ id: z.uuid(), isPinned: z.boolean() }))
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: { readonly id: string; readonly isPinned: boolean };
      }) => {
        const updated = await updateEveConversationMetadata(
          ctx.eveOwnerId,
          input.id,
          { isPinned: input.isPinned }
        );
        if (updated === undefined) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return updated;
      }
    ),
  rename: eveOwnedProcedure
    .input(
      z.object({
        id: z.uuid(),
        title: z.string().trim().nonempty().max(MAX_CONVERSATION_TITLE_LENGTH),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: { readonly id: string; readonly title: string };
      }) => {
        const updated = await updateEveConversationMetadata(
          ctx.eveOwnerId,
          input.id,
          { title: input.title }
        );
        if (updated === undefined) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return updated;
      }
    ),
  restoreAttachments: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        messageId: z.string().nonempty().max(MAX_MESSAGE_ID_LENGTH),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: ReadonlyNativeSurface<{
          conversationId: string;
          messageId: string;
        }>;
      }) => await restoreMessageAttachments(ctx.eveOwnerId, input)
    ),
  saveDocument: eveOwnedProcedure.input(eveManualDocumentInput).mutation(
    async ({
      ctx,
      input,
    }: {
      readonly ctx: { readonly eveOwnerId: string };
      readonly input: ReadonlyNativeSurface<{
        content: string;
        title: string;
        documentId: string;
        expectedRevisionId: string;
        conversationId: string;
        fileIds: string[];
        operationId: string;
      }>;
    }) => {
      try {
        return await saveManualEveDocument(ctx.eveOwnerId, input);
      } catch (error) {
        throw new TRPCError({
          cause: error,
          code: "CONFLICT",
          message:
            error instanceof Error
              ? error.message
              : "Document could not be saved.",
        });
      }
    }
  ),
  search: eveOwnedProcedure
    .input(
      z.object({
        cursor: z
          .object({
            id: z.uuid(),
            rank: z.number().nonnegative(),
            updatedAt: z.iso.datetime(),
          })
          .nullish(),
        ownerScope: z.string().nonempty().max(MAX_OWNER_SCOPE_LENGTH),
        search: z.string().trim().nonempty().max(MAX_SEARCH_QUERY_LENGTH),
      })
    )
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: ReadonlyNativeSurface<{
          ownerScope: string;
          search: string;
          cursor?:
            | { id: string; rank: number; updatedAt: string }
            | null
            | undefined;
        }>;
      }) => {
        if (input.ownerScope !== ctx.eveOwnerId) {
          throw new TRPCError({ code: "FORBIDDEN" });
        }
        return await searchEveConversations(ctx.eveOwnerId, input);
      }
    ),
  setVisibility: eveProcedure
    .input(
      z.object({ id: z.uuid(), visibility: z.enum(["private", "public"]) })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly user: { readonly id: string } };
        readonly input: ReadonlyNativeSurface<{
          id: string;
          visibility: "private" | "public";
        }>;
      }) => {
        const row = await updateEveConversationMetadata(ctx.user.id, input.id, {
          visibility: input.visibility,
        });
        if (row === undefined) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return row;
      }
    ),
  vote: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        messageId: z.string().nonempty().max(MAX_MESSAGE_ID_LENGTH),
        type: z.enum(["up", "down"]),
      })
    )
    .mutation(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: ReadonlyNativeSurface<{
          conversationId: string;
          messageId: string;
          type: "up" | "down";
        }>;
      }) => {
        const saved = await voteEveMessage(ctx.eveOwnerId, input);
        if (!saved) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Assistant message not found.",
          });
        }
        return saved;
      }
    ),
  votes: eveOwnedProcedure
    .input(z.object({ conversationId: z.uuid() }))
    .query(
      async ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: { readonly conversationId: string };
      }) => await getEveMessageVotes(ctx.eveOwnerId, input.conversationId)
    ),
});
