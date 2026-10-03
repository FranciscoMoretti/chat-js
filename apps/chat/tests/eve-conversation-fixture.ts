/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/db/client"; "../lib/db/schema" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { eq } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { db } from "../lib/db/client";
import { eveChat, eveConversation } from "../lib/db/schema";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

type ConversationFixture = Omit<
  typeof eveConversation.$inferInsert,
  "chatId" | "updatedAt"
> & {
  chatId?: string;
  isPinned?: boolean;
  title?: string;
  updatedAt?: Date | SQL;
};

/* oxlint-disable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions --
 * import/no-named-export (#527): Preserve the named insertEveConversationFixtures API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * import/prefer-default-export (#532): insertEveConversationFixtures remains a named API, consistent with no-default-export; adding future exports must not change caller import syntax.
 * jsdoc/require-param (#534): insertEveConversationFixtures's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): insertEveConversationFixtures's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-ternary (#518): insertEveConversationFixtures derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-async-await (#540): insertEveConversationFixtures sequences asynchronous fixture actions and assertions with await; promise-function-async also requires async implementations.
 * oxc/no-optional-chaining (#542): insertEveConversationFixtures handles optional parent?.chatId without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * oxc/no-rest-spread-properties (#543): insertEveConversationFixtures copies or separates ...conversation while preserving existing object ownership; mutating source objects is not equivalent.
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
    for (const fixture of Array.isArray(input) ? input : [input]) {
      const {
        chatId: requestedChatId,
        isPinned,
        title,
        updatedAt,
        ...conversation
      } = fixture;
      const [parent] = conversation.parentConversationId
        ? // oxlint-disable-next-line eslint/no-await-in-loop -- Later fixture rows may depend on a parent inserted earlier in this transaction.
          await tx
            .select({ chatId: eveConversation.chatId })
            .from(eveConversation)
            .where(eq(eveConversation.id, conversation.parentConversationId))
        : [];
      const chatId = requestedChatId ?? parent?.chatId ?? crypto.randomUUID();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Membership requires metadata to exist before the session row.
      await tx
        .insert(eveChat)
        .values({
          id: chatId,
          isPinned,
          ownerId: conversation.ownerId,
          title: title ?? conversation.firstMessage,
          titleStatus: title ? "manual" : "fallback",
          updatedAt,
        })
        .onConflictDoNothing();
      // oxlint-disable-next-line eslint/no-await-in-loop -- Preserve parent-before-child insertion order and return the actual session rows.
      const [row] = await tx
        .insert(eveConversation)
        .values({ ...conversation, chatId })
        .returning();
      inserted.push(row);
    }
    return inserted;
  });
/* oxlint-enable import/no-named-export, import/prefer-default-export, jsdoc/require-param, jsdoc/require-returns, no-ternary, oxc/no-async-await, oxc/no-optional-chaining, oxc/no-rest-spread-properties, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-boolean-expressions */
