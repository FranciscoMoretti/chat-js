import type {
  EveMessage,
  EveMessageMetadata,
  EveMessagePart,
} from "eve/client";
import type { EveMessageInput } from "./message-input";
// RC1 message data is readonly at the SDK boundary.
type ReadonlyEveMessage = EveMessage;
type ReadonlyEveMessagePart = EveMessagePart;
type ReadonlyEveMessageMetadata = EveMessageMetadata;
type ReadonlyEveMessageInput =
  | string
  | readonly Readonly<Exclude<EveMessageInput, string>[number]>[];
export type {
  ReadonlyEveMessage,
  ReadonlyEveMessagePart,
  ReadonlyEveMessageMetadata,
  ReadonlyEveMessageInput,
};
