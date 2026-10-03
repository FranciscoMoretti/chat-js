import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import { ControlledTransport } from "./thread-controlled-transport";

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ResumeTransport extends ControlledTransport {
  public lastReconnectOptions:
    | Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
    | undefined;

  public override reconnectToStream = (
    options: Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
  ) => {
    this.lastReconnectOptions = options;
    return Promise.resolve(
      new ReadableStream<UIMessageChunk>({
        start(controller): void {
          controller.enqueue({ id: "text", type: "text-start" });
          controller.enqueue({
            delta: "resumed",
            id: "text",
            type: "text-delta",
          });
          controller.enqueue({ id: "text", type: "text-end" });
          controller.enqueue({ finishReason: "stop", type: "finish" });
          controller.close();
        },
      })
    );
  };
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-module-boundary-types */
