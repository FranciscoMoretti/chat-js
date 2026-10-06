"use client";

import React, { useState } from "react";
import type { JSX as ReactJSX } from "react";
import { z } from "zod";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
/* oxlint-enable sort-imports */

type EveDeletionPhase =
  | "confirm"
  | "deleting"
  | "pending"
  | "unconfirmed"
  | "checking"
  | "unavailable"
  | "not_started";

const resultSchema = z.object({
  rootId: z.uuid(),
  status: z.enum(["active", "pending", "deleted"]),
});
/* oxlint-disable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, unicorn/no-null -- EveDeleteDialog: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 60_000); react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const EveDeleteDialog = ({
  conversation,
  onClose,
  onChanged,
}: {
  readonly conversation: {
    readonly id: string;
    readonly title: string;
    readonly state: string;
  };
  readonly onClose: () => void;
  readonly onChanged: (rootId: string) => Promise<void>;
}): ReactJSX.Element => {
  const [phase, setPhase] = useState<EveDeletionPhase>(
    // oxlint-disable-next-line no-ternary -- Keep useState argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    conversation.state === "deleting" ? "pending" : "confirm"
  );
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve request's awaited sequencing and rejected-Promise behavior. */
  const request = async (method: "GET" | "DELETE"): Promise<void> => {
    // oxlint-disable-next-line no-ternary -- Keep setPhase argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    setPhase(method === "GET" ? "checking" : "deleting");
    /* oxlint-disable react/todo -- Preserve the unconfirmed deletion recovery catch. */
    try {
      const response = await fetch(
        `/api/agent-conversations/${conversation.id}`,
        { method, signal: AbortSignal.timeout(60_000) }
      );
      if (response.status === 503) {
        setPhase("unavailable");
        return;
      }
      if (response.status === 409) {
        setPhase("not_started");
        return;
      }
      if (!response.ok) {
        // oxlint-disable-next-line react/todo -- Preserve the explicit unconfirmed deletion error.
        throw new Error("Deletion unconfirmed");
      }
      const result = resultSchema.parse(await response.json());
      if (result.status === "active") {
        setPhase("confirm");
        return;
      }
      if (result.status === "deleted") {
        await onChanged(result.rootId).catch(() => null);
        onClose();
        return;
      }
      setPhase("pending");
      await onChanged(result.rootId).catch(() => null);
    } catch {
      setPhase("unconfirmed");
    }
    /* oxlint-enable react/todo */
  };
  /* oxlint-enable oxc/no-async-await */
  return (
    <>
      {/* oxlint-disable-next-line eslint/no-use-before-define -- The controller stays above the reusable presentational view. */}
      <EveDeleteDialogView
        onCheck={() => {
          void request("GET");
        }}
        onClose={onClose}

        onDelete={() => {
          void request("DELETE");
        }}
        phase={phase}
        title={conversation.title}
      />
    </>
  );
};
/* oxlint-disable react/jsx-no-literals -- EveDeleteDialogView renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable max-lines-per-function, max-statements, no-magic-numbers, react-perf/jsx-no-new-function-as-prop, unicorn/no-null */

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- EveDeleteDialogView: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const EveDeleteDialogView = ({
  title,
  phase,
  onClose,
  onDelete,
  onCheck,
}: {
  title: string;
  phase: EveDeletionPhase;
  onClose: () => void;
  onDelete: () => void;
  onCheck: () => void;
}): ReactJSX.Element => {
  const busy = phase === "deleting" || phase === "checking";
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!(open || busy)) {
          onClose();
        }
      }}
      open
    >
      <DialogContent showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle
            // oxlint-disable-next-line react/forbid-component-props -- DialogTitle accepts className in its styling contract; preserve this caller's layout and appearance.
            className="mr-6"
          >
            Delete conversation and branches?
          </DialogTitle>
          <DialogDescription>
            “{title}” belongs to a conversation family. Deleting it permanently
            removes the original conversation, all its branches, and their
            files. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {phase === "not_started" && (
          <p role="alert">
            Deletion has not started. Finish recovering any pending conversation
            creation, then retry.
          </p>
        )}
        {phase === "deleting" && (
          <output>Deleting conversation and branches…</output>
        )}
        {phase === "checking" && <output>Checking deletion status…</output>}
        {phase === "pending" && (
          <output>
            Access has been removed, but cleanup is not complete. Retry to
            continue. You can also resume deletion from the sidebar later.
          </output>
        )}
        {phase === "unconfirmed" && (
          <p role="alert">
            The deletion result could not be confirmed. Check its status before
            continuing.
          </p>
        )}
        {phase === "unavailable" && (
          <p role="alert">
            Deletion is not available for this server configuration. Cleanup
            could not be completed.
          </p>
        )}
        <DialogFooter>
          <Button disabled={busy} onClick={onClose} variant="outline">
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              phase === "confirm" ? "Cancel" : "Close"
            }
          </Button>
          {(phase === "pending" || phase === "unconfirmed") && (
            <Button onClick={onCheck} variant="outline">
              Check status
            </Button>
          )}
          {(phase === "confirm" ||
            phase === "not_started" ||
            phase === "pending" ||
            phase === "deleting") && (
            <Button disabled={busy} onClick={onDelete} variant="destructive">
              {
                // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
                phase === "pending"
                  ? "Retry deletion"
                  : "Delete conversation and branches"
              }
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (EveDeleteDialog, EveDeleteDialogView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
export { EveDeleteDialog, EveDeleteDialogView };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (EveDeletionPhase); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { EveDeletionPhase };
/* oxlint-enable import/no-named-export */
