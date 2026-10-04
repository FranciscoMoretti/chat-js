import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";
import { ControlledTransport } from "./thread-controlled-transport";

const SDK_PARAMETER_INDEX = 0;

/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
export class ResumeTransport extends ControlledTransport {
  public lastReconnectOptions:
    | ReadonlyDeep<
        Parameters<
          ChatTransport<UIMessage>["reconnectToStream"]
        >[typeof SDK_PARAMETER_INDEX]
      >
    | undefined;

  public override reconnectToStream = (
    options: ReadonlyDeep<
      Parameters<
        ChatTransport<UIMessage>["reconnectToStream"]
      >[typeof SDK_PARAMETER_INDEX]
    >
  ): Promise<ReadableStream<UIMessageChunk>> => {
    this.lastReconnectOptions = options;
    return Promise.resolve(
      new ReadableStream<UIMessageChunk>({
        start(
          controller: Readonly<ReadableStreamDefaultController<UIMessageChunk>>
        ): void {
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
