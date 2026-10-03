import type { MessageStreamEvent } from "eve/client";

const MAX_SEARCH_QUERY_LENGTH = 255;

interface EveSearchText {
  key: string;
  text: string;
}

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns -- jsdoc/require-param (#534): eveSeedSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): eveSeedSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags. */
/** Index display text only: never reasoning, tool payloads, files, or auth metadata. */
const eveSeedSearchText = (
  messages: readonly {
    readonly role: string;
    readonly parts: readonly {
      readonly type: string;
      readonly text?: string;
    }[];
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- jsdoc/require-param (#534): eveEventSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): eveEventSearchText's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/prefer-readonly-parameter-types (#565): eveEventSearchText accepts event: MessageStreamEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): eveEventSearchText intentionally keeps the existing falsy-value behavior of event.data.message?.trim(); distinguishing empty, zero, and absent states requires a domain behavior decision. */
/** Immutable event identities make live delivery, restored prefixes and backfills idempotent. */
const eveEventSearchText = (event: MessageStreamEvent): EveSearchText[] => {
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
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
export { eveEventSearchText, eveSeedSearchText, MAX_SEARCH_QUERY_LENGTH };
export type { EveSearchText };
