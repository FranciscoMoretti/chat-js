// Hooks enabled by the with-data-stream middleware.

import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { ChatMessage } from "@/lib/ai/types";

import {
  type CustomChatStoreState,
  useCustomChatStoreApi,
} from "./custom-store-provider";

export function useDataStream() {
  const store = useCustomChatStoreApi<ChatMessage>();
  if (!store) {
    throw new Error("useDataStream must be used within CustomStoreProvider");
  }

  return useStoreWithEqualityFn(
    store,
    (state: CustomChatStoreState<ChatMessage>) => ({
      dataStream: state.dataStream,
      setDataStream: state.setDataStream,
    }),
    shallow
  );
}
