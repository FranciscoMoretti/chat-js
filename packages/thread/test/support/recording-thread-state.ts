import type { UIMessage } from "ai";

import { MemoryThreadState } from "../../src/thread-state";
import type { ThreadState } from "../../src/types";

export class RecordingThreadState implements ThreadState<UIMessage> {
  readonly #state: MemoryThreadState<UIMessage>;
  updateCount = 0;

  constructor(messages: UIMessage[]) {
    this.#state = new MemoryThreadState({ messages });
  }

  getSnapshot = () => this.#state.getSnapshot();
  subscribe = (listener: () => void) => this.#state.subscribe(listener);

  update: ThreadState<UIMessage>["update"] = (updater) => {
    this.updateCount += 1;
    this.#state.update(updater);
  };
}
