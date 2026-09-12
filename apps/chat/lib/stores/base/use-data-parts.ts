"use client";

import type { UIMessage } from "@ai-sdk/react";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { useChatMessages, useChatStore } from "./hooks";

/**
 * Interface for a data part extracted from messages
 */
export interface DataPart<T = unknown> {
  data: T;
  timestamp?: number;
  type: string;
}

/**
 * Result of useDataParts hook
 */
export interface UseDataPartsReturn {
  /** Latest data part for each type */
  all: DataPart<unknown>[];
  /** Latest data part grouped by type (without 'data-' prefix) */
  byType: Record<string, DataPart<unknown>>;
}

/**
 * Options for useDataPart hook
 */
export interface UseDataPartOptions<T = unknown> {
  /** Include callback fired when the data part updates */
  onData?: (data: DataPart<T>) => void;
}

/**
 * Hook to extract and access data parts from messages.
 * Returns the latest value for each data part type.
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { byType, all } = useDataParts();
 *
 *   const agentStatus = byType['agent-status'];
 *   const rateLimit = byType['rate-limit'];
 *
 *   return (
 *     <div>
 *       {agentStatus && <p>Status: {agentStatus.data.status}</p>}
 *       {rateLimit && <p>Remaining: {rateLimit.data.remaining}</p>}
 *     </div>
 *   );
 * }
 * ```
 */
export const useDataParts = (): UseDataPartsReturn => {
  const messages = useChatMessages();

  return useMemo(() => {
    const dataParts = extractDataPartsFromMessages(messages);

    // Group by type, keeping only the latest for each type
    // Strip 'data-' prefix from keys for cleaner API
    const byType: Record<string, DataPart<unknown>> = {};

    for (const dataPart of dataParts) {
      const key = dataPart.type.replace(/^data-/u, "");
      const existing = byType[key];
      if (
        !existing ||
        (dataPart.timestamp &&
          existing.timestamp &&
          dataPart.timestamp >= existing.timestamp)
      ) {
        byType[key] = dataPart;
      }
    }

    return {
      all: Object.values(byType),
      byType,
    };
  }, [messages]);
};

/**
 * Hook to extract and access a specific data part by type.
 * Returns a tuple with the data and a clear function, similar to useState.
 *
 * @template T - The type of the data part's data property
 * @param type - The data part type without 'data-' prefix (e.g., 'agent-status', 'rate-limit')
 * @param options - Optional configuration including onData callback
 * @returns Tuple of [data, clearFunction] - data is the latest value, clearFunction removes transient live data only
 *
 * @example
 * ```tsx
 * function AgentStatusIndicator() {
 *   const [agentStatus, clearStatus] = useDataPart<{ status: string; agent: string }>('agent-status');
 *
 *   if (!agentStatus) return null;
 *
 *   return (
 *     <div>
 *       <p>Agent {agentStatus.agent} is {agentStatus.status}</p>
 *       <button onClick={clearStatus}>Clear</button>
 *     </div>
 *   );
 * }
 * ```
 *
 * @example With callback
 * ```tsx
 * function RateLimitMonitor() {
 *   const [rateLimit] = useDataPart('rate-limit', {
 *     onData: (data) => {
 *       if (data.data.remaining < 10) {
 *         toast.warning('Rate limit running low!');
 *       }
 *     }
 *   });
 *
 *   return rateLimit ? <p>{rateLimit.remaining} requests remaining</p> : null;
 * }
 * ```
 */
export const useDataPart = <T = unknown>(
  type: string,
  options?: UseDataPartOptions<T>
): [T | null, () => void] => {
  const messages = useChatMessages();
  const { onData } = options || {};

  // Subscribe to the transient data map directly so we re-render when it changes
  const transientDataParts = useChatStore((state) => state._transientDataParts);
  const removeTransientDataPart = useChatStore(
    (state) => state.removeTransientDataPart
  );
  const prevDataRef = useRef<T | null>(null);

  const result = useMemo(() => {
    const dataParts = extractDataPartsFromMessages(messages);

    // Find the latest data part of the specified type
    // Automatically prepend 'data-' prefix for matching
    const fullType = type.startsWith("data-") ? type : `data-${type}`;
    let latest: DataPart<T> | null = null;

    for (const dataPart of dataParts) {
      if (
        dataPart.type === fullType &&
        (!latest ||
          (dataPart.timestamp &&
            latest.timestamp &&
            dataPart.timestamp >= latest.timestamp))
      ) {
        latest = dataPart as DataPart<T>;
      }
    }

    // Check transient data parts if not found in messages
    if (!latest) {
      const transientData = transientDataParts.get(fullType);
      if (transientData !== undefined) {
        latest = {
          data: transientData,
          type: fullType,
        };
      }
    }

    return latest;
  }, [messages, type, transientDataParts]);

  // Call onData callback when the underlying data changes
  useEffect(() => {
    const nextData = result ? result.data : null;
    if (result && onData && !Object.is(prevDataRef.current, nextData)) {
      onData(result);
    }
    prevDataRef.current = nextData;
  }, [result, onData]);

  // Memoize clear function to maintain referential equality. Persisted message parts are immutable here.
  const clear = useCallback(() => {
    const fullType = type.startsWith("data-") ? type : `data-${type}`;
    removeTransientDataPart(fullType);
  }, [type, removeTransientDataPart]);

  return [result ? result.data : null, clear];
};

/**
 * Extract all data parts from messages.
 * Data parts are identified by types starting with "data-".
 */
const extractDataPartsFromMessages = (
  messages: UIMessage[]
): DataPart<unknown>[] => {
  const dataParts: DataPart<unknown>[] = [];

  for (const message of messages) {
    // Check message parts for data parts
    if (message.parts && Array.isArray(message.parts)) {
      for (const part of message.parts) {
        // Check if this part is a data part (starts with "data-")
        if (part.type.startsWith("data-") && "data" in part) {
          const dataPart = part as {
            type: string;
            data: unknown;
            timestamp?: number;
          };
          if (dataPart.data !== undefined) {
            dataParts.push({
              data: dataPart.data,
              timestamp: dataPart.timestamp || Date.now(),
              type: dataPart.type,
            });
          }
        }

        // Also check tool call results that might contain data parts
        if (part.type.startsWith("tool-") && "result" in part && part.result) {
          const { result } = part;
          if (typeof result === "object" && result && "parts" in result) {
            const { parts } = result as { parts?: unknown[] };
            if (Array.isArray(parts)) {
              for (const nestedPart of parts) {
                const typedPart = nestedPart as {
                  type?: string;
                  data?: unknown;
                  timestamp?: number;
                };
                if (
                  typedPart.type?.startsWith("data-") &&
                  typedPart.data !== undefined
                ) {
                  dataParts.push({
                    data: typedPart.data,
                    timestamp: typedPart.timestamp || Date.now(),
                    type: typedPart.type,
                  });
                }
              }
            }
          }
        }
      }
    }
  }

  return dataParts;
};
