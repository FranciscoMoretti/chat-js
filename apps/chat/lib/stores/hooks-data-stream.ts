// Hooks enabled by the with-data-stream middleware.

import { shallow } from "zustand/shallow";
import { useStoreWithEqualityFn } from "zustand/traditional";

import type { ChatMessage } from "@/lib/ai/types";

import { useCustomChatStoreApi } from "./custom-store-provider";
import type { CustomChatStoreState } from "./custom-store-provider";

export const useDataStream = () => {
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
};
