"use client";

// Middleware that extends the chat store with per-chat transient stream data.

import type { DataUIPart, UIMessage } from "ai";
import type { SetStateAction } from "react";
import type { StateCreator } from "zustand";

import type { CustomUIDataTypes } from "@/lib/ai/types";
import type { StoreState as BaseChatStoreState } from "@/lib/stores/base";

export type DataStream = DataUIPart<CustomUIDataTypes>[];

export type DataStreamAugmentedState<UM extends UIMessage> =
  BaseChatStoreState<UM> & {
    dataStream: DataStream;
    setDataStream: (value: SetStateAction<DataStream>) => void;
  };

export const withDataStream =
  <UI_MESSAGE extends UIMessage, T extends BaseChatStoreState<UI_MESSAGE>>(
    creator: StateCreator<T, [], []>
  ): StateCreator<T & DataStreamAugmentedState<UI_MESSAGE>, [], []> =>
  (set, get, api) => {
    const base = creator(set, get, api);
    const originalReset = base.reset;

    return {
      ...base,
      dataStream: [],
      reset: () => {
        originalReset();
        set({ dataStream: [] } as Partial<
          T & DataStreamAugmentedState<UI_MESSAGE>
        >);
      },
      setDataStream: (value) => {
        set(
          (state) =>
            ({
              dataStream:
                typeof value === "function" ? value(state.dataStream) : value,
            }) as Partial<T & DataStreamAugmentedState<UI_MESSAGE>>
        );
      },
    };
  };
