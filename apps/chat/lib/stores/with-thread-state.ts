import {
  createThreadStateSnapshot,
  type ThreadStateSnapshot,
} from "@chatjs/thread";
import type { UIMessage } from "ai";
import type { StateCreator } from "zustand";
import type { StoreState as BaseChatStoreState } from "@/lib/stores/base";

export type ThreadStateStore<TMessage extends UIMessage> =
  BaseChatStoreState<TMessage> & {
    threadSnapshot: ThreadStateSnapshot<TMessage>;
    updateThreadSnapshot: (
      updater: (
        snapshot: ThreadStateSnapshot<TMessage>
      ) => ThreadStateSnapshot<TMessage>
    ) => void;
  };

export const withThreadState =
  <TMessage extends UIMessage, TState extends BaseChatStoreState<TMessage>>(
    creator: StateCreator<TState, [], []>,
    options: { initialSnapshot?: ThreadStateSnapshot<TMessage> } = {}
  ): StateCreator<TState & ThreadStateStore<TMessage>, [], []> =>
  (set, get, api) => {
    const base = creator(set, get, api);
    const threadSnapshot =
      options.initialSnapshot ??
      createThreadStateSnapshot({ messages: base.messages });

    base._messageIndex.update(threadSnapshot.messages);

    return {
      ...base,
      _throttledMessages: threadSnapshot.messages,
      error: threadSnapshot.error,
      messages: threadSnapshot.messages,
      status: threadSnapshot.status,
      threadSnapshot,
      updateThreadSnapshot: (updater) => {
        set((state) => {
          const threadSnapshot = updater(state.threadSnapshot);
          state._messageIndex.update(threadSnapshot.messages);

          return {
            ...state,
            _memoizedSelectors: new Map(),
            error: threadSnapshot.error,
            messages: threadSnapshot.messages,
            status: threadSnapshot.status,
            threadSnapshot,
          };
        });
        get()._scheduleThrottledMessagesUpdate();
      },
    };
  };
