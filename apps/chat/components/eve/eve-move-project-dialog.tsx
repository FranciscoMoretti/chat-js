"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { JSX as ReactJSX } from "react";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useId, useState } from "react";
/* oxlint-enable sort-imports */

import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveMoveProjectDialog); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- EveMoveProjectDialog renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions, unicorn/no-null -- EveMoveProjectDialog: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including available); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveMoveProjectDialog = ({
  conversation,
  onClose,
}: {
  readonly conversation: {
    readonly id: string;
    readonly title: string;
    readonly projectId: string | null;
  };
  readonly onClose: () => void;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const router = useRouter();
  const fieldId = useId();
  const [projectId, setProjectId] = useState(conversation.projectId ?? "");
  const projects = useQuery(trpc.project.list.queryOptions());
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve move's awaited sequencing and rejected-Promise behavior. */
  const move = useMutation(
    trpc.eve.assignProject.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          cache.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
          cache.invalidateQueries({ queryKey: trpc.eve.get.pathKey() }),
        ]);
        router.refresh();
        onClose();
      },
    })
  );
  /* oxlint-enable oxc/no-async-await */
  const available =
    !projectId ||
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading some from projects.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    projects.data?.some(
      (project: { readonly id: string }) => project.id === projectId
    );
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!(open || move.isPending)) {
          onClose();
        }
      }}
      open
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to project</DialogTitle>
          <DialogDescription>
            Choose a project for “{conversation.title}”. Its instructions will
            apply to subsequent responses.
          </DialogDescription>
        </DialogHeader>
        <Label htmlFor={fieldId}>Project</Label>
        <select
          className="bg-background h-10 w-full rounded-md border px-3 text-sm"
          disabled={projects.isPending || projects.isError || move.isPending}
          id={fieldId}
          onChange={(event: { readonly target: { readonly value: string } }) =>
            setProjectId(event.target.value)
          }
          value={projectId}
        >
          <option value="">No project</option>
          {!available && (
            <option disabled value={projectId}>
              Project unavailable
            </option>
          )}
          {
            /* oxlint-disable oxc/no-optional-chaining -- Keep the existing nullish guard when reading map from projects.data; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining. */
            projects.data?.map(
              (project: {
                readonly id: string;
                readonly name: string;
              }): React.JSX.Element => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              )
            )
            /* oxlint-enable oxc/no-optional-chaining */
          }
        </select>
        {projects.isPending && <output>Loading projects…</output>}
        {projects.isError && (
          <div role="alert">
            <p>Could not load projects.</p>
            <Button
              onClick={() => {
                void projects.refetch();
              }}
              variant="outline"
            >
              Retry
            </Button>
          </div>
        )}
        {move.isError && (
          <p role="alert">Could not move the conversation. Try again.</p>
        )}
        <DialogFooter>
          <Button disabled={move.isPending} onClick={onClose} variant="outline">
            Cancel
          </Button>
          <Button
            disabled={
              move.isPending ||
              projects.isPending ||
              projects.isError ||
              !available ||
              projectId === (conversation.projectId ?? "")
            }
            onClick={() =>
              move.mutate({
                conversationId: conversation.id,
                projectId: projectId || null,
              })
            }
          >
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              move.isPending ? "Moving…" : "Move"
            }
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-boolean-expressions, unicorn/no-null */
