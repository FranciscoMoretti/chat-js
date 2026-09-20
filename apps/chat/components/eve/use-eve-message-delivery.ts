"use client";

import type { MessageStreamEvent } from "eve/client";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  eveMessageDelivery,
  eveMessageOperationId,
} from "@/lib/eve/message-delivery";
import type { PendingEveMessage } from "@/lib/eve/message-delivery";

export const useEveMessageDelivery = (sessionId: string) => {
  const [pending, setPending] = useState<PendingEveMessage | null>(null);
  const pendingRef = useRef<PendingEveMessage | null | undefined>(undefined);
  const acknowledged = useRef<string | undefined>(undefined);

  useEffect(() => {
    const stored = eveMessageDelivery.read(sessionStorage, sessionId);
    pendingRef.current = stored;
    acknowledged.current = undefined;
    // oxlint-disable-next-line react/set-state-in-effect -- Synchronize the selected session with its browser delivery journal.
    setPending(stored);
    if (stored) {
      // oxlint-disable-next-line react/set-state-in-effect -- Restore the durable pending-message marker on mount.
      setPending((current) => {
        const restored = current ?? stored;
        pendingRef.current = restored;
        return restored;
      });
    }
  }, [sessionId]);

  const accept = useCallback(
    (event: MessageStreamEvent) => {
      const operationId = eveMessageOperationId(event);
      if (!operationId) {
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
          event
        )
      ) {
        return;
      }
      acknowledged.current = operationId;
      pendingRef.current = null;
      setPending((pendingMessage) =>
        pendingMessage?.operationId === operationId ? null : pendingMessage
      );
    },
    [sessionId]
  );

  return {
    accept,
    begin: useCallback(
      (input: Parameters<typeof eveMessageDelivery.begin>[2]) => {
        acknowledged.current = undefined;
        const delivery = eveMessageDelivery.begin(
          sessionStorage,
          sessionId,
          input
        );
        pendingRef.current = delivery;
        setPending(delivery);
        return delivery;
      },
      [sessionId]
    ),
    hasAcknowledged: useCallback(
      (operationId: string) => acknowledged.current === operationId,
      []
    ),
    pending,
    reject: useCallback(
      (delivery: PendingEveMessage, message: string) => {
        const rejected = eveMessageDelivery.reject(
          sessionStorage,
          sessionId,
          delivery,
          message
        );
        pendingRef.current = rejected;
        setPending(rejected);
      },
      [sessionId]
    ),
    release: useCallback(
      (delivery: PendingEveMessage) => {
        eveMessageDelivery.clear(
          sessionStorage,
          sessionId,
          delivery.operationId
        );
        if (pendingRef.current?.operationId === delivery.operationId) {
          pendingRef.current = null;
        }
        setPending((current) =>
          current?.operationId === delivery.operationId ? null : current
        );
      },
      [sessionId]
    ),
  };
};
