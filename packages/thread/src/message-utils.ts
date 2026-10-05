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

/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getMessageText); the enabled import/no-default-export convention rejects the default-export alternative. */
export { getMessageText };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReadonlyMessageValue); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { ReadonlyMessageValue };
/* oxlint-enable import/no-named-export */
