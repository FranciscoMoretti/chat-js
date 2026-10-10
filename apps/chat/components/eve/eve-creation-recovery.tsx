"use client";

import { useRouter } from "next/navigation";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { JSX as ReactJSX } from "react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useEffect, useRef, useState } from "react";
/* oxlint-enable sort-imports */

import { Button } from "@/components/ui/button";
import { CreationRejectedError } from "@/lib/eve/create-conversation";
import { eveMessageTitle } from "@/lib/eve/message-input";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  moveRejectedProjectCreation,
  readCreationRequest,
} from "@/lib/eve/pending-create";
/* oxlint-enable sort-imports */
import type { CreationScope } from "@/lib/eve/pending-create";
import { resolveCreationRequest } from "@/lib/eve/resolve-creation-request";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveCreationRecovery); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveCreationRecovery renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null -- EveCreationRecovery: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including scope?.projectId); typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

// oxlint-disable-next-line complexity -- Keep the existing persisted-request, project fallback and rejected-cleanup branches in the same recovery owner.
export const EveCreationRecovery = ({
  ownerId,
  operationId,
  firstMessage,
  scope,
  initiallyRejected = false,
  initialFailure = "",
  onClearRejected,
}: {
  readonly ownerId: string;
  readonly operationId?: string;
  readonly firstMessage: string;
  readonly scope?: Readonly<CreationScope>;
  readonly initiallyRejected?: boolean;
  readonly initialFailure?: string;
  readonly onClearRejected?: () => void;
}): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const router = useRouter();
  const lock = useRef(false);
  const [pending, setPending] =
    useState<ReturnType<typeof readCreationRequest>>();
  const [rejected, setRejected] = useState(initiallyRejected);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Reset recovery state when the server-provided rejection status changes.
    setRejected(initiallyRejected);
    try {
      const saved = readCreationRequest(sessionStorage, ownerId, scope);
      setPending(
        // oxlint-disable-next-line no-ternary -- Keep setPending argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        saved &&
          // oxlint-disable-next-line no-ternary -- Keep && operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          (typeof operationId === "string" && operationId !== ""
            ? saved.operationId === operationId
            : // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading projectId from scope; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
              scope?.projectId && saved.projectId === scope.projectId)
          ? saved
          : undefined
      );
    } catch {
      setFailure("The saved request could not be restored.");
    }
    setLoaded(true);
  }, [ownerId, operationId, scope, initiallyRejected]);

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve retry's awaited sequencing and rejected-Promise behavior. */
  const retry = async (): Promise<void> => {
    if (!pending || lock.current) {
      return;
    }
    lock.current = true;
    setBusy(true);
    setFailure("");
    /* oxlint-disable react/todo -- Preserve the recovery lock cleanup in finally. */
    try {
      const { id } = await resolveCreationRequest(
        sessionStorage,
        ownerId,
        pending,
        scope
      );
      globalThis.location.assign(`/chat/${id}`);
    } catch (error) {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading projectId from scope; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
      if (error instanceof CreationRejectedError && scope?.projectId) {
        setRejected(true);
      }
      setFailure(
        // oxlint-disable-next-line no-ternary -- Keep setFailure argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        error instanceof Error ? error.message : "Unable to recover. Try again."
      );
      // oxlint-disable-next-line react/todo -- React Compiler cannot analyze required recovery lock cleanup in finally.
    } finally {
      lock.current = false;
      setBusy(false);
    }
    /* oxlint-enable react/todo */
  };
  /* oxlint-enable oxc/no-async-await */
  const continueWithoutProject = (): void => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading projectId from scope; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    if (!(rejected && pending && scope?.projectId)) {
      return;
    }
    try {
      moveRejectedProjectCreation(
        sessionStorage,
        ownerId,
        scope.projectId,
        pending.operationId
      );
      globalThis.location.assign("/");
    } catch (error) {
      setFailure(
        // oxlint-disable-next-line no-ternary -- Keep setFailure argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        error instanceof Error ? error.message : "Unable to restore the draft."
      );
    }
  };

  let status = "Checking the saved request…";
  if (loaded) {
    // oxlint-disable-next-line no-ternary -- Keep = operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    status = pending
      ? "Conversation creation is unconfirmed. Retry the saved request to recover it."
      : "This browser does not have the original request. Return to the tab where you sent it, or check again if creation is still running.";
  }
  if (rejected && onClearRejected) {
    status =
      "The original request was rejected. Clear the saved request before sending again.";
  } else if (rejected) {
    status =
      "The original request was rejected. You can continue with the saved message outside this project.";
  }
  return (
    <section
      aria-label="Conversation recovery"
      className="mx-auto w-full max-w-3xl space-y-4 p-4"
    >
      <p className="break-words whitespace-pre-wrap">
        {
          // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          pending ? eveMessageTitle(pending.message) : firstMessage
        }
      </p>
      <output className="block">{status}</output>
      {(failure || initialFailure) && (
        <p role="alert">{failure || initialFailure}</p>
      )}
      {rejected && onClearRejected && (
        <Button onClick={onClearRejected}>Clear rejected request</Button>
      )}
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        rejected &&
        !onClearRejected /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading projectId from scope; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */ &&
        scope?.projectId ? (
          /* oxlint-enable oxc/no-optional-chaining */ <Button
            onClick={continueWithoutProject}
          >
            Continue without project
          </Button>
        ) : null
      }
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        !rejected && pending ? (
          <Button
            disabled={busy}

            onClick={() => {
              const completion = retry();
              // oxlint-disable-next-line oxc/no-async-await -- Start urgent busy updates before React owns the completion promise.
              startEventAction(async () => {
                await completion;
              });
            }}
          >
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              busy ? "Recovering…" : "Retry creation"
            }
          </Button>
        ) : null
      }
      {!pending && (
        <Button
          disabled={!loaded}
          onClick={() => router.refresh()}
          variant="outline"
        >
          Check again
        </Button>
      )}
    </section>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, max-statements, no-undefined, react-perf/jsx-no-new-function-as-prop, typescript/strict-boolean-expressions, typescript/strict-void-return, unicorn/no-null */
