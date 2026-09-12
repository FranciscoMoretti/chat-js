import { createThreadStateSnapshot } from "@chat-js/thread";
import type { ThreadStateSnapshot } from "@chat-js/thread";
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

const haveSelectedPathIdsChanged = <TMessage extends { id: string }>(
  previous: TMessage[] | null | undefined,
  next: TMessage[]
): boolean => {
  const previousMessages = previous ?? [];
  if (previousMessages.length !== next.length) {
    return true;
  }
  return previousMessages.some(
    (message, index) => message.id !== next[index]?.id
  );
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
        let didChangeSelectedPath = false;
        set((state) => {
          const nextSnapshot = updater(state.threadSnapshot);
          // Sibling switches change the rendered ids. Flush throttled
          // messages in the same update so UserMessage can still resolve
          // the ids it is currently rendering; otherwise it returns null
          // and the assistant jumps up for a frame.
          didChangeSelectedPath = haveSelectedPathIdsChanged(
            state._throttledMessages ?? state.messages,
            nextSnapshot.messages
          );
          state._messageIndex.update(nextSnapshot.messages);

          return {
            ...state,
            _memoizedSelectors: new Map(),
            error: nextSnapshot.error,
            messages: nextSnapshot.messages,
            status: nextSnapshot.status,
            threadSnapshot: nextSnapshot,
            ...(didChangeSelectedPath
              ? { _throttledMessages: nextSnapshot.messages }
              : {}),
          };
        });
        if (!didChangeSelectedPath) {
          get()._scheduleThrottledMessagesUpdate();
        }
      },
    };
  };
