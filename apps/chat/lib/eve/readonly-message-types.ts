import type {
  EveMessage,
  EveMessageMetadata,
  EveMessagePart,
} from "eve/client";
import type { EveMessageInput } from "./message-input";
/** Display enrichment belongs to ChatJS, not the native history contract. */
type ReadonlyEveMessage = Omit<EveMessage, "metadata"> & {
  readonly metadata?: ReadonlyEveMessageMetadata;
};
type ReadonlyEveMessagePart = EveMessagePart;
type ReadonlyEveMessageMetadata = EveMessageMetadata & {
  readonly modelId?: string;
  readonly custom?: Readonly<Record<string, unknown>>;
};
type ReadonlyEveMessageInput =
  | string
  | readonly Readonly<Exclude<EveMessageInput, string>[number]>[];
export type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
  ReadonlyEveMessageMetadata,
  ReadonlyEveMessageInput,
};
