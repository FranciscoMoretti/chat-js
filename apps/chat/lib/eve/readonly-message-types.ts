import type {
  EveMessage,
  EveMessageMetadata,
  EveMessagePart,
} from "eve/client";
import type { EveMessageInput } from "./message-input";

// Only the SDK's message-part data is mapped; opaque tool input/output remains unknown.
// Preserve every native member and its callable contract while marking data readonly.
type ReadonlyMessagePartData<Value> = Value extends
  | string
  | number
  | bigint
  | boolean
  | symbol
  | null
  | undefined
  ? Value
  : Value extends (...parameters: readonly never[]) => unknown
    ? Value
    : Value extends abstract new (...parameters: readonly never[]) => unknown
      ? Value
      : Value extends object
        ? {
            readonly [Property in keyof Value]: ReadonlyMessagePartData<
              Value[Property]
            >;
          }
        : Value;

type ReadonlyEveMessagePart = ReadonlyMessagePartData<EveMessagePart>;
type ReadonlyEveMessageInput =
  | string
  | readonly Readonly<Exclude<EveMessageInput, string>[number]>[];

// Preserve the full public message shape; JSON namespaces are opaque to rendering readers.
type ReadonlyEveMessageMetadata = Readonly<
  Omit<EveMessageMetadata, "custom" | "annotations">
> & {
  readonly custom?: Readonly<Record<string, unknown>>;
  readonly annotations?: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
};
type ReadonlyEveMessage = Readonly<Omit<EveMessage, "parts" | "metadata">> & {
  readonly parts: readonly ReadonlyEveMessagePart[];
  readonly metadata?: ReadonlyEveMessageMetadata;
};

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReadonlyEveMessageInput, ReadonlyEveMessagePart); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type {
  ReadonlyEveMessage,
  ReadonlyEveMessageInput,
  ReadonlyEveMessageMetadata,
  ReadonlyEveMessagePart,
};
/* oxlint-enable import/no-named-export */
