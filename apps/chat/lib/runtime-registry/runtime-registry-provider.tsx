"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

export type RuntimeId = string;

export interface Runtime<TData = unknown> {
  data: TData;
  runtimeId: RuntimeId;
}

export interface CreateRuntimeInput<TData = unknown> {
  data: TData;
  runtimeId: RuntimeId;
}

interface RuntimeRegistryContextValue<TData = unknown> {
  ensureRuntime: (input: CreateRuntimeInput<TData>) => void;
  getRuntimeById: (
    runtimeId: string | null | undefined
  ) => Runtime<TData> | null;
  runtimes: Runtime<TData>[];
}

const RuntimeRegistryContext =
  createContext<RuntimeRegistryContextValue | null>(null);

function assertValidRuntimeId(runtimeId: RuntimeId): asserts runtimeId {
  if (!runtimeId) {
    throw new Error("Runtime id is required");
  }
}

function createRuntime<TData>(
  input: CreateRuntimeInput<TData>
): Runtime<TData> {
  assertValidRuntimeId(input.runtimeId);

  return {
    data: input.data,
    runtimeId: input.runtimeId,
  };
}

function createInitialRuntimes<TData>(
  initialRuntimes: CreateRuntimeInput<TData>[]
) {
  const runtimes: Runtime<TData>[] = [];
  const seenRuntimeIds = new Set<string>();

  for (const initialRuntime of initialRuntimes) {
    assertValidRuntimeId(initialRuntime.runtimeId);

    if (seenRuntimeIds.has(initialRuntime.runtimeId)) {
      continue;
    }

    seenRuntimeIds.add(initialRuntime.runtimeId);
    runtimes.push(createRuntime(initialRuntime));
  }

  return runtimes;
}

export function RuntimeRegistryProvider<TData = unknown>({
  children,
  initialRuntimes = [],
}: {
  children: ReactNode;
  initialRuntimes?: CreateRuntimeInput<TData>[];
}) {
  const [runtimes, setRuntimes] = useState<Runtime<TData>[]>(() =>
    createInitialRuntimes(initialRuntimes)
  );

  useEffect(() => {
    const nextInitialRuntimes = createInitialRuntimes(initialRuntimes);

    if (nextInitialRuntimes.length === 0) {
      return;
    }

    setRuntimes((currentRuntimes) => {
      const missingRuntimes = nextInitialRuntimes.filter(
        (nextRuntime) =>
          !currentRuntimes.some(
            (runtime) => runtime.runtimeId === nextRuntime.runtimeId
          )
      );

      if (missingRuntimes.length === 0) {
        return currentRuntimes;
      }

      return [...currentRuntimes, ...missingRuntimes];
    });
  }, [initialRuntimes]);

  const getRuntimeById = useCallback(
    (runtimeId: string | null | undefined) => {
      if (!runtimeId) {
        return null;
      }

      return (
        runtimes.find((runtime) => runtime.runtimeId === runtimeId) ?? null
      );
    },
    [runtimes]
  );

  const ensureRuntime = useCallback((input: CreateRuntimeInput<TData>) => {
    assertValidRuntimeId(input.runtimeId);

    setRuntimes((currentRuntimes) => {
      if (
        currentRuntimes.some((runtime) => runtime.runtimeId === input.runtimeId)
      ) {
        return currentRuntimes;
      }

      return [...currentRuntimes, createRuntime(input)];
    });
  }, []);

  const value = useMemo(
    () => ({
      ensureRuntime,
      getRuntimeById,
      runtimes,
    }),
    [ensureRuntime, getRuntimeById, runtimes]
  );

  return (
    <RuntimeRegistryContext.Provider
      value={value as RuntimeRegistryContextValue}
    >
      {children}
    </RuntimeRegistryContext.Provider>
  );
}

export function useRuntimeRegistry<TData = unknown>() {
  const context = useContext(RuntimeRegistryContext);
  if (!context) {
    throw new Error(
      "useRuntimeRegistry must be used within RuntimeRegistryProvider"
    );
  }
  return context as RuntimeRegistryContextValue<TData>;
}

export function RuntimeSlots<TData = unknown>({
  children,
}: {
  children: (runtime: Runtime<TData>) => ReactNode;
}) {
  const { runtimes } = useRuntimeRegistry<TData>();

  return (
    <>
      {runtimes.map((runtime) => (
        <Fragment key={runtime.runtimeId}>{children(runtime)}</Fragment>
      ))}
    </>
  );
}
