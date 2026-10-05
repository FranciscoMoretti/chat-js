import type { UIMessage } from "ai";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ThreadCore } from "./thread-core";
/* oxlint-enable sort-imports */
import type { ThreadCoreOptions } from "./thread-core";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  CanonicalMessage,
  MessageData,
  MessageMetadata,
  MessageTools,
} from "./types";
/* oxlint-enable sort-imports */

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

export { AbstractThread };
