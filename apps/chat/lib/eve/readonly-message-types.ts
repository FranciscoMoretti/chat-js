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

// Imported transcripts retain model-facing text output without changing native tool parts.
type ImportedPartMetadata<Part> = Part extends {
  readonly state: "output-available";
}
  ? Part & { readonly outputType?: "text" }
  : Part;
type ReadonlyEveMessagePart = ReadonlyMessagePartData<
  ImportedPartMetadata<EveMessagePart>
>;
type ReadonlyEveMessageInput =
  | string
  | readonly Readonly<Exclude<EveMessageInput, string>[number]>[];

// Native lifecycle fields plus app-owned imported provenance and display metadata.
// These fields are not runtime authorization or billing evidence.
type ReadonlyEveMessageMetadata = Readonly<
  Omit<EveMessageMetadata, "custom">
> & {
  readonly custom?: Readonly<Record<string, unknown>>;
  readonly modelId?: string;
};
type ReadonlyEveMessage = Readonly<Omit<EveMessage, "parts" | "metadata">> & {
  readonly parts: readonly ReadonlyEveMessagePart[];
  readonly metadata?: ReadonlyEveMessageMetadata;
};

export type {
  ReadonlyEveMessage,
  ReadonlyEveMessageInput,
  ReadonlyEveMessageMetadata,
  ReadonlyEveMessagePart,
};
