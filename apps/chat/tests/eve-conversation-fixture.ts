/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 */
import { eq } from "drizzle-orm";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { SQL } from "drizzle-orm";
/* oxlint-enable sort-imports */

import { db } from "../lib/db/client";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { eveChat, eveConversation } from "../lib/db/schema";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

type ConversationFixture = Omit<
  typeof eveConversation.$inferInsert,
  "chatId" | "updatedAt"
> & {
  chatId?: string;
  isPinned?: boolean;
  title?: string;
  updatedAt?: Date | SQL;
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (insertEveConversationFixtures); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve insertEveConversationFixtures's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * jsdoc/require-param (#534): insertEveConversationFixtures's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): insertEveConversationFixtures's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/explicit-function-return-type (#560): Keep insertEveConversationFixtures's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep insertEveConversationFixtures's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): insertEveConversationFixtures accepts input: ConversationFixture | ConversationFixture[]; tx; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): insertEveConversationFixtures preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections.
 * typescript/strict-boolean-expressions (#610): insertEveConversationFixtures intentionally keeps the existing falsy-value behavior of conversation.parentConversationId; title; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Seed metadata and session membership together, including parent-first batches. */
export const insertEveConversationFixtures = (
  input: ConversationFixture | ConversationFixture[]
) =>
  db.transaction(async (tx) => {
    const inserted: (typeof eveConversation.$inferSelect)[] = [];
    // oxlint-disable-next-line no-ternary -- Keep loop iterable as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    for (const fixture of Array.isArray(input) ? input : [input]) {
      const {
        chatId: requestedChatId,
        isPinned,
        title,
        updatedAt,
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding conversation excludes chatId, isPinned, title, updatedAt from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
        ...conversation
      } = fixture;
      // oxlint-disable-next-line no-ternary -- Keep [parent] as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      const [parent] = conversation.parentConversationId
        ? // oxlint-disable-next-line eslint/no-await-in-loop -- Later fixture rows may depend on a parent inserted earlier in this transaction.
          await tx
            .select({ chatId: eveConversation.chatId })
            .from(eveConversation)
            .where(eq(eveConversation.id, conversation.parentConversationId))
        : [];
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading chatId from parent; preserve one receiver evaluation, skipped accesses and the existing parent?.chatId fallback. The app guidance prefers optional chaining.
      const chatId = requestedChatId ?? parent?.chatId ?? crypto.randomUUID();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Membership requires metadata to exist before the session row.
      await tx
        .insert(eveChat)
        .values({
          id: chatId,
          isPinned,
          ownerId: conversation.ownerId,
          title: title ?? conversation.firstMessage,
          // oxlint-disable-next-line no-ternary -- Keep titleStatus as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          titleStatus: title ? "manual" : "fallback",
          updatedAt,
        })
        .onConflictDoNothing();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Preserve parent-before-child insertion order and return the actual session rows.
      const [row] = await tx
        .insert(eveConversation)
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing conversation own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        .values({ ...conversation, chatId })
        .returning();
      inserted.push(row);
    }
    return inserted;
  });
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
