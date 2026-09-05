import type { ThreadState } from "@chat-js/thread";
import type { UIMessage } from "ai";
import type { CustomChatStoreApi } from "./custom-store-provider";

export class ZustandThreadState<TMessage extends UIMessage>
  implements ThreadState<TMessage>
{
  readonly #store: CustomChatStoreApi<TMessage>;

  constructor(store: CustomChatStoreApi<TMessage>) {
    this.#store = store;
  }

  getSnapshot = () => this.#store.getState().threadSnapshot;

  subscribe = (listener: () => void) =>
    this.#store.subscribe(
      (state) => state.threadSnapshot,
      () => listener()
    );

  update: ThreadState<TMessage>["update"] = (updater) => {
    this.#store.getState().updateThreadSnapshot(updater);
  };
}
