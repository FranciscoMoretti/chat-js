import type { DeepPartial } from "ai";
import type { InstalledTools } from "./installed-tools";
import type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
} from "@/lib/eve/readonly-message-types";

type NativeToolPart = Extract<ReadonlyEveMessagePart, { type: "dynamic-tool" }>;

type ToolState<
  Name extends keyof InstalledTools,
  Part = NativeToolPart,
> = Part extends NativeToolPart
  ? Omit<Part, "type" | "toolName" | "input" | "output"> & {
      readonly type: `tool-${Name}`;
      readonly toolName: Name;
      /** Original transport part, for native integrations and persisted history. */
      readonly native: NativeToolPart;
      readonly updates?: readonly unknown[];
    } & (Part extends { state: "input-streaming" }
        ? {
            readonly input?: DeepPartial<InstalledTools[Name]["input"]>;
            readonly output?: never;
          }
        : Part extends { state: "output-error" }
          ? { readonly input: unknown; readonly output?: never }
          : Part extends { state: "output-available" }
            ? {
                readonly input: InstalledTools[Name]["input"];
                readonly output: InstalledTools[Name]["output"];
              }
            : {
                readonly input: InstalledTools[Name]["input"];
                readonly output?: never;
              })
  : never;

/** Tool name and lifecycle state jointly discriminate the authored payload types. */
export type ChatToolPart = {
  [Name in keyof InstalledTools]: ToolState<Name>;
}[keyof InstalledTools];

/** Native fallback parts retain unknown payloads; only installed tools are enriched. */
export type ChatMessagePart = ReadonlyEveMessagePart | ChatToolPart;

export type ChatMessage = Omit<ReadonlyEveMessage, "parts"> & {
  readonly parts: readonly ChatMessagePart[];
};

export interface ChatMessageData {
  readonly messages: readonly ChatMessage[];
}

export const isChatToolPart = (part: ChatMessagePart): part is ChatToolPart =>
  "native" in part;

/** Native consumers must receive the original receipt and lifecycle, not the UI view. */
export const nativeMessagePart = (
  part: ChatMessagePart
): ReadonlyEveMessagePart => (isChatToolPart(part) ? part.native : part);

const isNativeMessage = (message: ChatMessage): message is ReadonlyEveMessage =>
  !message.parts.some(isChatToolPart);

const nativeViews = new WeakMap<ChatMessage, ReadonlyEveMessage>();
const nativeLists = new WeakMap<
  readonly ChatMessage[],
  readonly ReadonlyEveMessage[]
>();

export const nativeMessage = (message: ChatMessage): ReadonlyEveMessage => {
  const cached = nativeViews.get(message);
  if (cached) {
    return cached;
  }
  const native = isNativeMessage(message)
    ? message
    : { ...message, parts: message.parts.map(nativeMessagePart) };
  nativeViews.set(message, native);
  return native;
};

/** Preserve native integration dependencies when the UI rerenders the same snapshot. */
export const nativeMessages = (
  messages: readonly ChatMessage[]
): readonly ReadonlyEveMessage[] => {
  const cached = nativeLists.get(messages);
  if (cached) {
    return cached;
  }
  const native = messages.map(nativeMessage);
  nativeLists.set(messages, native);
  return native;
};
