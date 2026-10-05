import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import type { ReadonlyDeep } from "./readonly-types";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ControlledTransport } from "./thread-controlled-transport";
/* oxlint-enable sort-imports */

const SDK_PARAMETER_INDEX = 0;

export class ResumeTransport extends ControlledTransport {
  public lastReconnectOptions:
    | ReadonlyDeep<
        Parameters<
          ChatTransport<UIMessage>["reconnectToStream"]
        >[typeof SDK_PARAMETER_INDEX]
      >
    | undefined;

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve reconnectToStream's awaited sequencing and rejected-Promise behavior. */
  public override reconnectToStream = async (
    options: ReadonlyDeep<
      Parameters<
        ChatTransport<UIMessage>["reconnectToStream"]
      >[typeof SDK_PARAMETER_INDEX]
    >
  ): Promise<ReadableStream<UIMessageChunk>> => {
    this.lastReconnectOptions = options;
    return await Promise.resolve(
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
  /* oxlint-enable oxc/no-async-await */
}
