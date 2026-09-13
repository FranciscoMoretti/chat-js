import type { ChatTransport, UIMessage, UIMessageChunk } from "ai";

import { ControlledTransport } from "./thread-controlled-transport";

export class ResumeTransport extends ControlledTransport {
  lastReconnectOptions:
    | Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
    | undefined;

  override reconnectToStream = (
    options: Parameters<ChatTransport<UIMessage>["reconnectToStream"]>[0]
  ) => {
    this.lastReconnectOptions = options;
    return Promise.resolve(
      new ReadableStream<UIMessageChunk>({
        start(controller) {
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
