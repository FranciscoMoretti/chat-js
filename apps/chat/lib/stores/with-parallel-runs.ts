"use client";

import type { UIMessage } from "ai";
import type { StateCreator } from "zustand";
import type { StoreState as BaseChatStoreState } from "@/lib/stores/base";

export type ParallelRunsAugmentedState<UM extends UIMessage> =
  BaseChatStoreState<UM> & {
    parallelRunIdsByGroup: Record<string, Record<number, string>>;
    registerParallelRun: (input: {
      parallelGroupId: string;
      parallelIndex: number;
      runId: string;
    }) => void;
  };

export const withParallelRuns =
  <TMessage extends UIMessage, TState extends BaseChatStoreState<TMessage>>(
    creator: StateCreator<TState, [], []>
  ): StateCreator<TState & ParallelRunsAugmentedState<TMessage>, [], []> =>
  (set, get, api) => {
    const base = creator(set, get, api);
    const originalReset = base.reset;

    return {
      ...base,
      parallelRunIdsByGroup: {},
      registerParallelRun: ({ parallelGroupId, parallelIndex, runId }) => {
        set((state) => ({
          ...state,
          parallelRunIdsByGroup: {
            ...state.parallelRunIdsByGroup,
            [parallelGroupId]: {
              ...state.parallelRunIdsByGroup[parallelGroupId],
              [parallelIndex]: runId,
            },
          },
        }));
      },
      reset: () => {
        originalReset();
        set((state) => ({
          ...state,
          parallelRunIdsByGroup: {},
        }));
      },
    };
  };
