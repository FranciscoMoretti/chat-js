// Hooks enabled by the with-chat-persistence middleware.

import { useEffect, useState } from "react";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { ChatMessage } from "@/lib/ai/types";

import { useCustomChatStoreApi } from "./custom-store-provider";
import type {
  CustomChatStoreApi,
  CustomChatStoreState,
} from "./custom-store-provider";

const useChatPersistenceStore = <T>(
  selector: (store: CustomChatStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean
): T => {
  const store = useCustomChatStoreApi();
  if (!store) {
    throw new Error(
      "useChatPersistenceStore must be used within CustomStoreProvider"
    );
  }
  return useStoreWithEqualityFn(store, selector, equalityFn);
};

export const useIsChatPersisted = (_chatId?: string) =>
  useChatPersistenceStore((state) => state.isChatPersisted);

export const useChatPersistenceActions = () =>
  useChatPersistenceStore(
    (state) => ({
      setChatPersisted: state.setChatPersisted,
    }),
    shallow
  );

export const useRuntimeIsChatPersisted = (
  store: CustomChatStoreApi<ChatMessage> | null | undefined
) => {
  const [isPersisted, setIsPersisted] = useState(
    () => store?.getState().isChatPersisted ?? true
  );

  useEffect(() => {
    if (!store) {
      setIsPersisted(true);
      return;
    }

    setIsPersisted(store.getState().isChatPersisted);
    return store.subscribe((state) => state.isChatPersisted, setIsPersisted);
  }, [store]);

  return isPersisted;
};
