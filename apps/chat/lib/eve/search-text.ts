import type { MessageStreamEvent } from "eve/client";

const MAX_SEARCH_QUERY_LENGTH = 255;

interface EveSearchText {
  key: string;
  text: string;
}

/**
 * Index display text only: never reasoning, tool payloads, files, or auth metadata.
 * @param messages Seeded message parts and roles whose visible text may enter the search index.
 * @returns Nonempty user/assistant text indexed by its original seed position.
 */
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

/* oxlint-disable typescript/prefer-readonly-parameter-types --
typescript/prefer-readonly-parameter-types (#565): eveEventSearchText accepts event: MessageStreamEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Immutable event identities make live delivery, restored prefixes and backfills idempotent.
 * @param event Native history or live event that may contain visible user/assistant text.
 * @returns Display text with stable event/seed keys, including restored history and excluding empty content.
 */
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
  if (
    event.type === "message.completed" &&
    typeof event.data.message === "string" &&
    event.data.message.trim() !== ""
  ) {
    return [{ key: `event:${event.meta.id}`, text: event.data.message }];
  }
  return [];
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { eveEventSearchText, eveSeedSearchText, MAX_SEARCH_QUERY_LENGTH };
export type { EveSearchText };
