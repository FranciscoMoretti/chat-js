import type { SessionEvent } from "eve/client";

const MAX_SEARCH_QUERY_LENGTH = 255;

interface EveSearchText {
  readonly key: string;
  readonly text: string;
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

const eveEventSearchText = (event: SessionEvent): EveSearchText[] => {
  if (event.type === "session.started" && event.data.transcriptSeed) {
    return eveSeedSearchText(event.data.transcriptSeed.messages);
  }
  if (event.type === "delivery.consumed") {
    const text = event.data.parts
      .flatMap((part) => (part.kind === "text" ? [part.text] : []))
      .join("\n");
    return text.trim()
      ? [{ key: `delivery:${event.data.deliveryId}`, text }]
      : [];
  }
  if (
    event.type === "content.completed" &&
    event.data.kind === "text" &&
    typeof event.data.value === "string" &&
    event.data.value.trim()
  ) {
    return [{ key: `part:${event.data.partId}`, text: event.data.value }];
  }
  return [];
};
export { eveEventSearchText, eveSeedSearchText, MAX_SEARCH_QUERY_LENGTH };
export type { EveSearchText };
