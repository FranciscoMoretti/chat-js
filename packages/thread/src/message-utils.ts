import type { UIMessage } from "ai";

type ReadonlyMessageValue<TValue> = TValue extends readonly unknown[]
  ? readonly ReadonlyMessageValue<TValue[number]>[]
  : TValue extends object
    ? { readonly [TKey in keyof TValue]: ReadonlyMessageValue<TValue[TKey]> }
    : TValue;

const getMessageText = (message: ReadonlyMessageValue<UIMessage>): string =>
  message.parts
    .map((part): string => {
      if (part.type === "text") {
        return part.text;
      }
      return "";
    })
    .join("");

export { getMessageText };
export type { ReadonlyMessageValue };
