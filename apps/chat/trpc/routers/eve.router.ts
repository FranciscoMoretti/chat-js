/* oxlint-disable eslint/max-lines -- Readonly DTO and native boundary declarations add type-only lines to this existing router module; preserve its procedure surface and runtime sequencing. */
/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "@trpc/server" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { getAccessibleEveDocument } from "@/lib/db/eve-documents";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  getEveChatIdentity,
  listEveConversationBranches,
  listEveConversations,
  updateEveConversationMetadata,
} from "@/lib/db/eve-queries";
/* oxlint-enable sort-imports */
import { searchEveConversations } from "@/lib/db/eve-search";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  assignEveConversationProject,
  getEveMessageVotes,
} from "@/lib/db/queries";
/* oxlint-enable sort-imports */
import { eveManualDocumentInput } from "@/lib/eve/document-contracts";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { eveHistoryInput } from "@/lib/eve/history-input";
/* oxlint-enable sort-imports */
import { resolveEvePrincipal } from "@/lib/eve/principal";
import { restoreMessageAttachments } from "@/lib/eve/restore-message-attachments";
import { saveManualEveDocument } from "@/lib/eve/save-document";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/eve/search-text";
/* oxlint-enable sort-imports */
import { voteEveMessage } from "@/lib/eve/vote-message";
// oxlint-disable-next-line eslint/sort-imports -- Preserve runtime module evaluation order and keep type-only declarations beside the owning module; the pinned binding-order rule requires a different grouping.
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/trpc/init";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */

const eveProcedure = protectedProcedure;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve eveOwnedProcedure's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable typescript/strict-boolean-expressions -- * typescript/strict-boolean-expressions (#610): eveOwnedProcedure intentionally keeps the existing falsy-value behavior of ownerId; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const eveOwnedProcedure = publicProcedure.use(
  async ({
    ctx,
    next,
  }: Readonly<
    Pick<
      // oxlint-disable-next-line no-magic-numbers -- Zero selects the existing first SDK middleware parameter in this type-only contract.
      Parameters<(typeof publicProcedure)["_def"]["middlewares"][0]>[0],
      "next"
    >
  > & { readonly ctx: { readonly user?: { readonly id: string } | null } }) => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from ctx.user; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    let ownerId = ctx.user?.id;
    if (!ownerId) {
      const principal = await resolveEvePrincipal(await headers());
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading ownerId from principal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      ownerId = principal?.ownerId;
    }
    if (!ownerId) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return await next({ ctx: { eveOwnerId: ownerId } });
  }
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveRouter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve eveRouter's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls -- * no-magic-numbers (#517): eveRouter uses 1, 255, 512, 128 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/promise-function-async (#606): eveRouter preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): eveRouter intentionally keeps the existing falsy-value behavior of ownerId; row; input.ownerScope; updated; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): eveRouter keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold. */
export const eveRouter = createTRPCRouter({
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
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading id from ctx.user; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        let ownerId = ctx.user?.id;
        if (!ownerId) {
          const principal = await resolveEvePrincipal(await headers());
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading ownerId from principal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
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
        if (!row) {
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
      if (input.ownerScope && input.ownerScope !== ctx.eveOwnerId) {
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
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return updated;
      }
    ),
  rename: eveOwnedProcedure
    .input(z.object({ id: z.uuid(), title: z.string().trim().min(1).max(255) }))
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
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return updated;
      }
    ),
  restoreAttachments: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        messageId: z.string().min(1).max(512),
      })
    )
    .mutation(
      ({
        ctx,
        input,
      }: {
        readonly ctx: { readonly eveOwnerId: string };
        readonly input: ReadonlyNativeSurface<{
          conversationId: string;
          messageId: string;
        }>;
      }) => restoreMessageAttachments(ctx.eveOwnerId, input)
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
            // oxlint-disable-next-line no-ternary -- Keep message as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
        ownerScope: z.string().min(1).max(128),
        search: z.string().trim().min(1).max(MAX_SEARCH_QUERY_LENGTH),
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
        if (!row) {
          throw new TRPCError({ code: "NOT_FOUND" });
        }
        return row;
      }
    ),
  vote: eveOwnedProcedure
    .input(
      z.object({
        conversationId: z.uuid(),
        messageId: z.string().min(1).max(512),
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-magic-numbers, typescript/promise-function-async, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
