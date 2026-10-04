import type { UIMessage } from "ai";

type ReadonlyMessageValue<TValue> = TValue extends readonly unknown[]
  ? readonly ReadonlyMessageValue<TValue[number]>[]
  : TValue extends object
    ? { readonly [TKey in keyof TValue]: ReadonlyMessageValue<TValue[TKey]> }
    : TValue;

const getMessageText = (message: ReadonlyMessageValue<UIMessage>): string =>
  message.parts
    .map((part): string => (part.type === "text" ? part.text : ""))
    .join("");

export { getMessageText };
export type { ReadonlyMessageValue };
