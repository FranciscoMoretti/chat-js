import type { CanonicalMessage, ThreadInit } from "./types";
import { AbstractThread } from "./abstract-thread";
import { MemoryThreadState } from "./thread-state";
import type { UIMessage } from "ai";

class Thread<
  TMessage extends UIMessage = UIMessage,
> extends AbstractThread<TMessage> {
  public constructor({
    initialTree,
    messages,
    ...options
  }: ThreadInit<TMessage> = {}) {
    super({
      ...options,
      state: new MemoryThreadState<CanonicalMessage<TMessage>>({
        initialTree,
        messages,
      }),
    });
  }
}

const createThread = <TMessage extends UIMessage = UIMessage>(
  options: ThreadInit<TMessage> = {}
): Thread<TMessage> => new Thread(options);

export { Thread, createThread };
