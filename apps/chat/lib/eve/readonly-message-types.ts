import type { EveMessagePart } from "eve/client";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EveMessageInput } from "./message-input";
/* oxlint-enable sort-imports */

// Only the SDK's message-part data is mapped; opaque tool input/output remains unknown.
type ReadonlyMessagePartData<Value> = Value extends object
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

/* oxlint-disable import/no-named-export -- Keep the named type bindings (ReadonlyEveMessageInput, ReadonlyEveMessagePart); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ReadonlyEveMessageInput, ReadonlyEveMessagePart };
/* oxlint-enable import/no-named-export */
