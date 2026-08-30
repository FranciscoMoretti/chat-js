// Hooks enabled by the with-chat-persistence middleware.

import { useEffect, useState } from "react";
import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";
import type { ChatMessage } from "@/lib/ai/types";
import {
  type CustomChatStoreApi,
  type CustomChatStoreState,
  useCustomChatStoreApi,
} from "./custom-store-provider";

function useChatPersistenceStore<T>(
  selector: (store: CustomChatStoreState) => T,
  equalityFn?: (a: T, b: T) => boolean
): T {
  const store = useCustomChatStoreApi();
  if (!store) {
    throw new Error(
      "useChatPersistenceStore must be used within CustomStoreProvider"
    );
  }
  return useStoreWithEqualityFn(store, selector, equalityFn);
}

export function useIsChatPersisted(_chatId?: string) {
  return useChatPersistenceStore((state) => state.isChatPersisted);
}

export function useChatPersistenceActions() {
  return useChatPersistenceStore(
    (state) => ({
      setChatPersisted: state.setChatPersisted,
    }),
    shallow
  );
}

export function useRuntimeIsChatPersisted(
  store: CustomChatStoreApi<ChatMessage> | null | undefined
) {
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
}
