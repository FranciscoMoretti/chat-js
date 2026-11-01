"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { eveMessageDelivery } from "@/lib/eve/message-delivery";
import type {
  DeliveryReceipt,
  PendingEveMessage,
} from "@/lib/eve/message-delivery";

const createDeliveryStore = (sessionId: string) => {
  let pending: PendingEveMessage | null = null;
  let loaded = false;
  const pendingRef: { current: PendingEveMessage | null | undefined } = {
    current: undefined,
  };
  const acknowledged: { current: string | undefined } = { current: undefined };
  const listeners = new Set<() => void>();
  const setPending = (
    change:
      | PendingEveMessage
      | null
      | ((current: PendingEveMessage | null) => PendingEveMessage | null)
  ): void => {
    pending = typeof change === "function" ? change(pending) : change;
    for (const listener of listeners) {
      listener();
    }
  };
  return {
    pendingRef,
    acknowledge: (operationId?: string): void => {
      acknowledged.current = operationId;
    },
    hasAcknowledged: (operationId: string): boolean =>
      acknowledged.current === operationId,
    setPending,
    getSnapshot: () => pending,
    getServerSnapshot: (): null => null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      // An acknowledgement may arrive before React subscribes; never resurrect it.
      if (!loaded) {
        loaded = true;
        if (pendingRef.current === undefined) {
          pendingRef.current = eveMessageDelivery.read(
            sessionStorage,
            sessionId
          );
        }
        setPending(pendingRef.current);
      }
      return () => {
        listeners.delete(listener);
      };
    },
  };
};

export const useEveMessageDelivery = (sessionId: string) => {
  const store = useMemo(() => createDeliveryStore(sessionId), [sessionId]);
  const pending = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );
  const { pendingRef, acknowledge, hasAcknowledged, setPending } = store;

  const accept = useCallback(
    (receipt: DeliveryReceipt) => {
      const { operationId } = receipt;
      if (!(typeof operationId === "string" && operationId !== "")) {
        return;
      }
      const current =
        pendingRef.current === undefined
          ? eveMessageDelivery.read(sessionStorage, sessionId)
          : pendingRef.current;
      pendingRef.current = current;
      if (
        !current ||
        current.operationId !== operationId ||
        !eveMessageDelivery.acknowledge(
          sessionStorage,
          sessionId,
          current,
          receipt
        )
      ) {
        return;
      }
      acknowledge(operationId);
      pendingRef.current = null;
      setPending((pendingMessage) => {
        if (pendingMessage?.operationId === operationId) {
          return null;
        }
        return pendingMessage;
      });
    },
    [sessionId, pendingRef, acknowledge, setPending]
  );

  return {
    accept,
    begin: useCallback(
      (input: Parameters<typeof eveMessageDelivery.begin>[2]) => {
        acknowledge();
        const delivery = eveMessageDelivery.begin(
          sessionStorage,
          sessionId,
          input
        );
        pendingRef.current = delivery;
        setPending(delivery);
        return delivery;
      },
      [sessionId, pendingRef, acknowledge, setPending]
    ),
    hasAcknowledged,
    pending,
    reject: useCallback(
      (delivery: PendingEveMessage, message: string, retryable = false) => {
        const rejected = eveMessageDelivery.reject(
          sessionStorage,
          sessionId,
          delivery,
          message,
          retryable
        );
        pendingRef.current = rejected;
        setPending(rejected);
      },
      [sessionId, pendingRef, setPending]
    ),
    release: useCallback(
      (delivery: Readonly<Pick<PendingEveMessage, "operationId">>) => {
        eveMessageDelivery.clear(
          sessionStorage,
          sessionId,
          delivery.operationId
        );
        if (pendingRef.current?.operationId === delivery.operationId) {
          pendingRef.current = null;
        }
        setPending((current) => {
          if (current?.operationId === delivery.operationId) {
            return null;
          }
          return current;
        });
      },
      [sessionId, pendingRef, setPending]
    ),
    retry: useCallback(
      (delivery: PendingEveMessage) => {
        const retried = eveMessageDelivery.retry(
          sessionStorage,
          sessionId,
          delivery
        );
        if (retried) {
          pendingRef.current = retried;
          setPending(retried);
        }
        return retried;
      },
      [sessionId, pendingRef, setPending]
    ),
  };
};
