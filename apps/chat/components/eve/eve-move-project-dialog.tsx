"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { JSX as ReactJSX } from "react";
import React, { useId, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/trpc/react";
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- EveMoveProjectDialog: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including project); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including available); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
  const available =
    !projectId || projects.data?.some((project) => project.id === projectId);
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
          onChange={(event) => setProjectId(event.target.value)}
          value={projectId}
        >
          <option value="">No project</option>
          {!available && (
            <option disabled value={projectId}>
              Project unavailable
            </option>
          )}
          {projects.data?.map((project): React.JSX.Element => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
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
            {move.isPending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
