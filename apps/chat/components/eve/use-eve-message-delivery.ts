"use client";

import type { MessageStreamEvent } from "eve/client";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  eveMessageDelivery,
  eveMessageOperationId,
} from "@/lib/eve/message-delivery";
import type { PendingEveMessage } from "@/lib/eve/message-delivery";
/* oxlint-disable max-lines-per-function, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- useEveMessageDelivery: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 2); no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including current); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
      [sessionId]
    ),
  };
};
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
