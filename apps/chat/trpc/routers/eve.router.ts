import {
  getEveSendReceipt,
  getEveMessageDisplayReceipts,
} from "@/lib/db/eve-dispatch";
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
import { eveHistoryInput } from "@/lib/eve/history-input";
import { eveManualDocumentInput } from "@/lib/eve/document-contracts";

import { resolveEvePrincipal } from "@/lib/eve/principal";
import { restoreMessageAttachments } from "@/lib/eve/restore-message-attachments";
import { saveManualEveDocument } from "@/lib/eve/save-document";

import { eveOwnedProcedure } from "@/trpc/eve-owned-procedure";

import { createTRPCRouter, publicProcedure } from "@/trpc/init";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

const MAX_CONVERSATION_TITLE_LENGTH = 255;
const MAX_MESSAGE_ID_LENGTH = 512;

export const eveRouter = createTRPCRouter({
  messageDisplay: eveOwnedProcedure
    .input(z.object({ sessionId: z.string().min(1).max(200) }))
    .query(
      async ({ ctx, input }) =>
        await getEveMessageDisplayReceipts(ctx.eveOwnerId, input.sessionId)
    ),
  sendReceipt: eveOwnedProcedure
    .input(
      z.object({ sessionId: z.string().min(1).max(200), operationId: z.uuid() })
    )
    .query(
      async ({ ctx, input }) =>
        await getEveSendReceipt(
          ctx.eveOwnerId,
          input.sessionId,
          input.operationId
        )
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
        surface?: "sidebar" | "all" | undefined;
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
});
