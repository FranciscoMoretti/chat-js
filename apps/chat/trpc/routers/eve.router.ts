/* oxlint-disable eslint/max-lines -- Readonly DTO and native boundary declarations add type-only lines to this existing router module; preserve its procedure surface and runtime sequencing. */
/* oxlint-disable import/max-dependencies --
 * import/max-dependencies (#524): import from "@trpc/server" participates in this module's explicit integration boundary; hiding dependencies behind aggregators would not reduce coupling.
 */
import { MAX_SEARCH_QUERY_LENGTH } from "@/lib/eve/search-text";
import { TRPCError } from "@trpc/server";
import { headers } from "next/headers";
import { z } from "zod";

// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between zod and @/lib/db/eve-documents still needs a supported server equivalence check; preserve the existing order meanwhile.
import { getAccessibleEveDocument } from "@/lib/db/eve-documents";
// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between @/lib/db/eve-documents and @/lib/db/eve-queries still needs a supported server equivalence check; preserve the existing order meanwhile.
import {
  getEveChatIdentity,
  listEveConversationBranches,
  listEveConversations,
  updateEveConversationMetadata,
} from "@/lib/db/eve-queries";
import { searchEveConversations } from "@/lib/db/eve-search";
// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between @/lib/db/eve-search and @/lib/db/queries still needs a supported server equivalence check; preserve the existing order meanwhile.
import {
  assignEveConversationProject,
  getEveMessageVotes,
} from "@/lib/db/queries";
import { eveHistoryInput } from "@/lib/eve/history-input";
import { eveManualDocumentInput } from "@/lib/eve/document-contracts";

import { resolveEvePrincipal } from "@/lib/eve/principal";
import { restoreMessageAttachments } from "@/lib/eve/restore-message-attachments";
import { saveManualEveDocument } from "@/lib/eve/save-document";

import { voteEveMessage } from "@/lib/eve/vote-message";

// oxlint-disable-next-line sort-imports -- Import-order migration debt: the native permutation between @/lib/eve/vote-message and @/trpc/init still needs a supported server equivalence check; preserve the existing order meanwhile.
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/trpc/init";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
/* oxlint-enable import/max-dependencies */

const MAX_CONVERSATION_TITLE_LENGTH = 255;
const MAX_MESSAGE_ID_LENGTH = 512;
const MAX_OWNER_SCOPE_LENGTH = 128;

const eveProcedure = protectedProcedure;

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve eveOwnedProcedure's awaited sequencing and rejected-Promise behavior. */
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
    if (typeof ownerId !== "string" || ownerId === "") {
      const principal = await resolveEvePrincipal(await headers());
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading ownerId from principal; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      ownerId = principal?.ownerId;
    }
    if (typeof ownerId !== "string" || ownerId === "") {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return await next({ ctx: { eveOwnerId: ownerId } });
  }
);
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (eveRouter); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve eveRouter's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable typescript/promise-function-async, unicorn/max-nested-calls -- * typescript/promise-function-async (#606): eveRouter preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
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
        if (typeof ownerId !== "string" || ownerId === "") {
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
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- Database readers destructure possibly empty result arrays but declare non-nullable objects; retain the missing-row guard until those owned return contracts include undefined. Explicit undefined is rejected by no-undefined, and typeof undefined by no-typeof-undefined.
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
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- Database readers destructure possibly empty result arrays but declare non-nullable objects; retain the missing-row guard until those owned return contracts include undefined. Explicit undefined is rejected by no-undefined, and typeof undefined by no-typeof-undefined.
        if (!updated) {
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
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- Database readers destructure possibly empty result arrays but declare non-nullable objects; retain the missing-row guard until those owned return contracts include undefined. Explicit undefined is rejected by no-undefined, and typeof undefined by no-typeof-undefined.
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
        messageId: z.string().nonempty().max(MAX_MESSAGE_ID_LENGTH),
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
        // oxlint-disable-next-line typescript/strict-boolean-expressions -- Database readers destructure possibly empty result arrays but declare non-nullable objects; retain the missing-row guard until those owned return contracts include undefined. Explicit undefined is rejected by no-undefined, and typeof undefined by no-typeof-undefined.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/promise-function-async, unicorn/max-nested-calls */
