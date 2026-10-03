import type { MessageStreamEvent } from "eve/client";

/* oxlint-disable import/group-exports, import/no-named-export --
 * import/group-exports (#523): MAX_SEARCH_QUERY_LENGTH stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named MAX_SEARCH_QUERY_LENGTH API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export const MAX_SEARCH_QUERY_LENGTH = 255;
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/no-named-export --
 * import/no-named-export (#527): Preserve the named EveSearchText API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export interface EveSearchText {
  key: string;
  text: string;
}
/* oxlint-enable import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, no-ternary, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): eveSeedSearchText stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveSeedSearchText API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): eveSeedSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveSeedSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-ternary (#518): eveSeedSearchText derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * typescript/prefer-readonly-parameter-types (#565): eveSeedSearchText accepts messages: readonly { role: string; parts: readonly { type: string; text?: string }[];; message; part; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Index display text only: never reasoning, tool payloads, files, or auth metadata. */
export const eveSeedSearchText = (
  messages: readonly {
    role: string;
    parts: readonly { type: string; text?: string }[];
  }[]
): EveSearchText[] =>
  messages.flatMap((message, index) => {
    const text = message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text ?? "")
      .join("\n")
      .trim();
    return text && ["user", "assistant"].includes(message.role)
      ? [{ key: `seed:${index}`, text }]
      : [];
  });
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, no-ternary, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, no-ternary, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): eveEventSearchText stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveEventSearchText API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): eveEventSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): eveEventSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * no-ternary (#518): eveEventSearchText derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * oxc/no-optional-chaining (#542): eveEventSearchText handles optional event.data.message?.trim() without repeated reads; expanding guards requires preserving missing-value and evaluation semantics.
 * typescript/prefer-readonly-parameter-types (#565): eveEventSearchText accepts event: MessageStreamEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveEventSearchText intentionally keeps the existing falsy-value behavior of event.data.message?.trim(); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Immutable event identities make live delivery, restored prefixes and backfills idempotent. */
export const eveEventSearchText = (
  event: MessageStreamEvent
): EveSearchText[] => {
  if (event.type === "history.seeded") {
    return eveSeedSearchText(event.data.messages);
  }
  if (event.type === "history.restored") {
    return event.data.events.flatMap(eveEventSearchText);
  }
  if (event.type === "message.received" && !event.data.kind) {
    const text = event.data.parts
      ? event.data.parts
          .filter((part) => part.type === "text")
          .map((part) => part.text)
          .join("\n")
      : event.data.message;
    return text.trim() ? [{ key: `event:${event.meta.id}`, text }] : [];
  }
  if (event.type === "message.completed" && event.data.message?.trim()) {
    return [{ key: `event:${event.meta.id}`, text: event.data.message }];
  }
  return [];
};
/* oxlint-enable import/group-exports, import/no-named-export, jsdoc/require-param, jsdoc/require-returns, no-ternary, oxc/no-optional-chaining, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
