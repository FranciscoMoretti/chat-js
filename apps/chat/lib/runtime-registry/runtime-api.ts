"use client";

import { useMemo } from "react";

import {
  type CreateRuntimeInput,
  useRuntimeRegistry,
} from "./runtime-registry-provider";

export interface RuntimeActions<TData = unknown> {
  ensureRuntime: (input: CreateRuntimeInput<TData>) => void;
}

export function useRuntimeActions<TData = unknown>(): RuntimeActions<TData> {
  const { ensureRuntime } = useRuntimeRegistry<TData>();

  return useMemo(
    () => ({
      ensureRuntime,
    }),
    [ensureRuntime]
  );
}

export function useRuntime<TData = unknown>(
  runtimeId: string | null | undefined
) {
  const { getRuntimeById } = useRuntimeRegistry<TData>();
  return getRuntimeById(runtimeId);
}
