import type { MessageStreamEvent } from "eve/client";

const MAX_SEARCH_QUERY_LENGTH = 255;

interface EveSearchText {
  key: string;
  text: string;
}

/**
 * Index display text only: never reasoning, tool payloads, files, or auth metadata.
 * @param {readonly { readonly role: string; readonly parts: readonly { readonly type: string; readonly text?: string; }[]; }[]} messages Seeded message parts and roles whose visible text may enter the search index.
 * @returns {EveSearchText[]} Nonempty user/assistant text indexed by its original seed position.
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
    if (text && ["user", "assistant"].includes(message.role)) {
      return [{ key: `seed:${index}`, text }];
    }
    return [];
  });

/** Read the display text of an incoming event without trimming its stored value.
 * @param {{ readonly data: { readonly message: string; readonly parts?: readonly { readonly type: string; readonly text?: string }[]; }; readonly meta: { readonly id: string; }; }} event Incoming message fields needed to extract visible text and preserve its event identity.
 * @returns {EveSearchText[]} The nonempty display text item, or an empty array.
 */
const incomingMessageSearchText = (event: {
  readonly data: {
    readonly message: string;
    readonly parts?: readonly {
      readonly type: string;
      readonly text?: string;
    }[];
  };
  readonly meta: { readonly id: string };
}): EveSearchText[] => {
  // oxlint-disable-next-line no-ternary -- Keep text as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const text = event.data.parts
    ? event.data.parts
        .filter((part) => part.type === "text")
        .map((part) => part.text)
        .join("\n")
    : event.data.message;
  if (text.trim()) {
    return [{ key: `event:${event.meta.id}`, text }];
  }
  return [];
};

/* oxlint-disable typescript/prefer-readonly-parameter-types --
typescript/prefer-readonly-parameter-types (#565): eveEventSearchText accepts event: MessageStreamEvent; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/**
 * Immutable event identities make live delivery, restored prefixes and backfills idempotent.
 * @param {MessageStreamEvent} event Native history or live event that may contain visible user/assistant text.
 * @returns {EveSearchText[]} Display text with stable event/seed keys, including restored history and excluding empty content.
 */
const eveEventSearchText = (event: MessageStreamEvent): EveSearchText[] => {
  if (event.type === "history.seeded") {
    return eveSeedSearchText(event.data.messages);
  }
  if (event.type === "history.restored") {
    return event.data.events.flatMap(eveEventSearchText);
  }
  if (event.type === "message.received" && !event.data.kind) {
    return incomingMessageSearchText(event);
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
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (eveEventSearchText, eveSeedSearchText, MAX_SEARCH_QUERY_LENGTH); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { eveEventSearchText, eveSeedSearchText, MAX_SEARCH_QUERY_LENGTH };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveSearchText); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { EveSearchText };
/* oxlint-enable import/no-named-export */
