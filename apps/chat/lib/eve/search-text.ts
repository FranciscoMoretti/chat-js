import type { MessageStreamEvent } from "eve/client";
import type { EveCopySeed } from "./copy-seed";

/** SDK fields this reader does not inspect remain optional and opaque. */
type IgnoredSdkFields<Value> = Value extends object
  ? { readonly [Key in keyof Value]?: unknown }
  : unknown;

// Accepted copy plans are indexed before native session binding.
type SeedMessage = EveCopySeed["messages"][number];
type IncomingMessage = Extract<
  MessageStreamEvent,
  { type: "message.received" }
>;

type SearchTextEvent = IgnoredSdkFields<MessageStreamEvent> &
  (
    | {
        readonly type: "history.seeded";
        readonly data: {
          readonly messages: Parameters<typeof eveSeedSearchText>[0];
        } & IgnoredSdkFields<
          Extract<MessageStreamEvent, { type: "history.seeded" }>["data"]
        >;
      }
    | {
        readonly type: "history.restored";
        readonly data: {
          readonly events: readonly SearchTextEvent[];
        } & IgnoredSdkFields<
          Extract<MessageStreamEvent, { type: "history.restored" }>["data"]
        >;
      }
    | {
        readonly type: "message.received";
        readonly data: Parameters<
          typeof incomingMessageSearchText
        >[0]["data"] & {
          readonly kind?: Extract<
            MessageStreamEvent,
            { type: "message.received" }
          >["data"]["kind"];
        };
        readonly meta: { readonly id: string } & IgnoredSdkFields<
          MessageStreamEvent["meta"]
        >;
      }
    | {
        readonly type: "message.completed";
        readonly data: { readonly message: string | null } & IgnoredSdkFields<
          Extract<MessageStreamEvent, { type: "message.completed" }>["data"]
        >;
        readonly meta: { readonly id: string } & IgnoredSdkFields<
          MessageStreamEvent["meta"]
        >;
      }
    | {
        readonly type: Exclude<
          MessageStreamEvent["type"],
          | "history.seeded"
          | "history.restored"
          | "message.received"
          | "message.completed"
        >;
      }
  );

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
  messages: readonly ({
    readonly role: string;
    readonly parts: readonly ({
      readonly type: string;
      readonly text?: string;
    } & IgnoredSdkFields<SeedMessage["parts"][number]>)[];
  } & IgnoredSdkFields<SeedMessage>)[]
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
    readonly parts?: readonly ({
      readonly type: string;
      readonly text?: string;
    } & IgnoredSdkFields<
      NonNullable<IncomingMessage["data"]["parts"]>[number]
    >)[];
  } & IgnoredSdkFields<IncomingMessage["data"]>;
  readonly meta: { readonly id: string } & IgnoredSdkFields<
    MessageStreamEvent["meta"]
  >;
}): EveSearchText[] => {
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

/**
 * Immutable event identities make live delivery, restored prefixes and backfills idempotent.
 * @param {MessageStreamEvent} event Native history or live event that may contain visible user/assistant text.
 * @returns {EveSearchText[]} Display text with stable event/seed keys, including restored history and excluding empty content.
 */
const eveEventSearchText = (event: SearchTextEvent): EveSearchText[] => {
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

export { eveEventSearchText, eveSeedSearchText, MAX_SEARCH_QUERY_LENGTH };
export type { EveSearchText };
