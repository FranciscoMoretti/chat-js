/* oxlint-disable import/max-dependencies  --
 * import/max-dependencies (#524): import from "@trpc/server" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
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
} from "@/lib/db/queries";
import { eveManualDocumentInput } from "@/lib/eve/document-contracts";
import { eveHistoryInput } from "@/lib/eve/history-input";
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { restoreMessageAttachments } from "@/lib/eve/restore-message-attachments";
import { saveManualEveDocument } from "@/lib/eve/save-document";
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/eve/search-text";
import { voteEveMessage } from "@/lib/eve/vote-message";
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/trpc/init";
/* oxlint-enable import/max-dependencies */

const eveProcedure = protectedProcedure;

/* oxlint-disable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions  --
 * oxc/no-async-await (#540): eveOwnedProcedure sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): eveOwnedProcedure handles optional ctx.user?.id; principal?.ownerId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): eveOwnedProcedure accepts { ctx, next }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveOwnedProcedure intentionally keeps the existing falsy-value behavior of ownerId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
const eveOwnedProcedure = publicProcedure.use(async ({ ctx, next }) => {
  let ownerId = ctx.user?.id;
  if (!ownerId) {
    const principal = await resolveEvePrincipal(await headers());
    ownerId = principal?.ownerId;
  }
  if (!ownerId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return await next({ ctx: { eveOwnerId: ownerId } });
});
/* oxlint-enable typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls  --
 * import/no-named-export (#527): Preserve the named eveRouter API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): eveRouter remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * no-magic-numbers (#517): eveRouter uses 1, 255, 512, 128 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * no-ternary (#518): eveRouter derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): eveRouter sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): eveRouter handles optional ctx.user?.id; principal?.ownerId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): eveRouter accepts { ctx, input }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): eveRouter preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): eveRouter intentionally keeps the existing falsy-value behavior of ownerId; row; input.ownerScope; updated; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): eveRouter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
export const eveRouter = createTRPCRouter({
  assignProject: eveProcedure
    .input(
      z.object({ conversationId: z.uuid(), projectId: z.uuid().nullable() })
    )
    .mutation(async ({ ctx, input }) => {
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
    }),
  branches: eveOwnedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const family = await listEveConversationBranches(
        ctx.eveOwnerId,
        input.id
      );
      if (!family) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return family;
    }),
  document: publicProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        documentId: z.uuid(),
        revisionId: z.uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let ownerId = ctx.user?.id;
      if (!ownerId) {
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
    }),
  get: eveOwnedProcedure
    .input(z.object({ id: z.uuid() }))
    .query(async ({ ctx, input }) => {
      const row = await getEveChatIdentity(ctx.eveOwnerId, input.id);
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return row;
    }),
  list: eveOwnedProcedure
    .input(eveHistoryInput)
    .query(async ({ ctx, input }) => {
      if (input.ownerScope && input.ownerScope !== ctx.eveOwnerId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await listEveConversations(ctx.eveOwnerId, input);
    }),
  pin: eveOwnedProcedure
    .input(z.object({ id: z.uuid(), isPinned: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const updated = await updateEveConversationMetadata(
        ctx.eveOwnerId,
        input.id,
        { isPinned: input.isPinned }
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),
  rename: eveOwnedProcedure
    .input(z.object({ id: z.uuid(), title: z.string().trim().min(1).max(255) }))
    .mutation(async ({ ctx, input }) => {
      const updated = await updateEveConversationMetadata(
        ctx.eveOwnerId,
        input.id,
        { title: input.title }
      );
      if (!updated) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return updated;
    }),
  restoreAttachments: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        messageId: z.string().min(1).max(512),
      })
    )
    .mutation(({ ctx, input }) =>
      restoreMessageAttachments(ctx.eveOwnerId, input)
    ),
  saveDocument: eveOwnedProcedure
    .input(eveManualDocumentInput)
    .mutation(async ({ ctx, input }) => {
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
    }),
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
        ownerScope: z.string().min(1).max(128),
        search: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH),
      })
    )
    .query(async ({ ctx, input }) => {
      if (input.ownerScope !== ctx.eveOwnerId) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      return await searchEveConversations(ctx.eveOwnerId, input);
    }),
  setVisibility: eveProcedure
    .input(
      z.object({ id: z.uuid(), visibility: z.enum(["private", "public"]) })
    )
    .mutation(async ({ ctx, input }) => {
      const row = await updateEveConversationMetadata(ctx.user.id, input.id, {
        visibility: input.visibility,
      });
      if (!row) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }
      return row;
    }),
  vote: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        messageId: z.string().min(1).max(512),
        type: z.enum(["up", "down"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const saved = await voteEveMessage(ctx.eveOwnerId, input);
      if (!saved) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Assistant message not found.",
        });
      }
      return saved;
    }),
  votes: eveOwnedProcedure
    .input(z.object({ conversationId: z.uuid() }))
    .query(
      async ({ ctx, input }) =>
        await getEveMessageVotes(ctx.eveOwnerId, input.conversationId)
    ),
});
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
