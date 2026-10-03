import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import { ControlledTransport } from "./thread-controlled-transport";

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ResumeTransport extends ControlledTransport {
  public lastReconnectOptions:
    | Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
    | undefined;

  public override reconnectToStream = (
    options: Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
  ): Promise<ReadableStream<UIMessageChunk>> => {
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
/* oxlint-enable eslint/no-magic-numbers */
