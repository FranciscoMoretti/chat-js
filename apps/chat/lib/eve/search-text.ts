import type { MessageStreamEvent } from "eve/client";

export interface EveSearchText {
  key: string;
  text: string;
}

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
