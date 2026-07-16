"use client";

// App-level persistence/confirmation state for a single chat store.

import type { UIMessage } from "ai";
import type { StateCreator } from "zustand";
import type { StoreState as BaseChatStoreState } from "@/lib/stores/base";

export type ChatPersistenceAugmentedState<UM extends UIMessage> =
  BaseChatStoreState<UM> & {
    isChatPersisted: boolean;
    setChatPersisted: (isPersisted: boolean) => void;
  };

export const withChatPersistence =
  <UI_MESSAGE extends UIMessage, T extends BaseChatStoreState<UI_MESSAGE>>(
    creator: StateCreator<T, [], []>,
    options: { initialIsChatPersisted?: boolean } = {}
  ): StateCreator<T & ChatPersistenceAugmentedState<UI_MESSAGE>, [], []> =>
  (set, get, api) => {
    const base = creator(set, get, api);
    const originalReset = base.reset;

    return {
      ...base,
      isChatPersisted: options.initialIsChatPersisted ?? false,
      reset: () => {
        originalReset();
        set({
          isChatPersisted: false,
        } as Partial<T & ChatPersistenceAugmentedState<UI_MESSAGE>>);
      },
      setChatPersisted: (isPersisted) => {
        set({ isChatPersisted: isPersisted } as Partial<
          T & ChatPersistenceAugmentedState<UI_MESSAGE>
        >);
      },
    };
  };
