import {
  getEveMessageDisplayReceipts,
  getEveSendReceipt,
} from "@/lib/db/eve-dispatch";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
  getEveChatIdentity,
  listEveConversationBranches,
  listEveConversations,
  updateEveConversationMetadata,
} from "@/lib/db/eve-queries";
import { eveHistoryInput } from "@/lib/eve/history-input";

import { restoreMessageAttachments } from "@/lib/eve/restore-message-attachments";

import { eveOwnedProcedure } from "@/trpc/eve-owned-procedure";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { createTRPCRouter } from "@/trpc/init";

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
});
