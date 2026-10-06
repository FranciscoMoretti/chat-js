"use client";

import type { MessageStreamEvent } from "eve/client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { useCallback, useEffect, useRef, useState } from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import {
  eveMessageDelivery,
  eveMessageOperationId,
} from "@/lib/eve/message-delivery";
/* oxlint-enable sort-imports */
import type { PendingEveMessage } from "@/lib/eve/message-delivery";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (useEveMessageDelivery); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
        // oxlint-disable-next-line no-ternary -- Keep current as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
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
      setPending((pendingMessage) => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading operationId from pendingMessage; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        if (pendingMessage?.operationId === operationId) {
          return null;
        }
        return pendingMessage;
      });
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
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading operationId from pendingRef.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
        if (pendingRef.current?.operationId === delivery.operationId) {
          pendingRef.current = null;
        }
        setPending((current) => {
          // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading operationId from current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
          if (current?.operationId === delivery.operationId) {
            return null;
          }
          return current;
        });
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable max-lines-per-function, no-magic-numbers, no-undefined, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
