import type { UIMessage } from "ai";

import { MemoryThreadState } from "../../src/thread-state";
import type { ThreadState } from "../../src/types";

export class RecordingThreadState implements ThreadState {
  readonly #state: MemoryThreadState;
  public updateCount = 0;

  public constructor(messages: UIMessage[]) {
    this.#state = new MemoryThreadState({ messages });
  }

  public getSnapshot = () => this.#state.getSnapshot();
  public subscribe = (listener: () => void) => this.#state.subscribe(listener);

  public update: ThreadState["update"] = (updater) => {
    this.updateCount += 1;
    this.#state.update(updater);
  };
}
