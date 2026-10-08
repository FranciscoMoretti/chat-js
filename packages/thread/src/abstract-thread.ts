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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward the original SDK schemas and live state controller; recursive readonly schema arrays are incompatible with the SDK constructor.
    options: ThreadCoreOptions<CanonicalMessage<TMessage>>
  ) {
    super(options);
  }
}

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (AbstractThread); the enabled import/no-default-export convention rejects the default-export alternative. */
export { AbstractThread };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
