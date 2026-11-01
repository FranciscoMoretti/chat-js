import type {
  CanonicalMessage,
  MessageData,
  MessageMetadata,
  MessageTools,
} from "./types";
import { ThreadCore } from "./thread-core";
import type { ThreadCoreOptions } from "./thread-core";
import type { UIMessage } from "ai";

abstract class AbstractThread<
  TMessage extends UIMessage = UIMessage,
> extends ThreadCore<
  MessageMetadata<TMessage>,
  MessageData<TMessage>,
  MessageTools<TMessage>
> {
  // A declaration-only optional marker preserves inference from a supplied
  // thread; all public message values still use the canonical SDK shape.
  declare protected readonly messageSpecialization?: TMessage;

  protected constructor(
    options: ThreadCoreOptions<CanonicalMessage<TMessage>>
  ) {
    super(options);
  }
}

export { AbstractThread };
