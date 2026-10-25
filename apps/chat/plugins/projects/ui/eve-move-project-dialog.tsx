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

export const EveMoveProjectDialog = ({
  conversation,
  onClose,
}: {
  readonly conversation: {
    readonly id: string;
    readonly title: string;
  };
  readonly onClose: () => void;
}): ReactJSX.Element => {
  const trpc = useTRPC();
  const cache = useQueryClient();
  const router = useRouter();
  const fieldId = useId();
  const assigned = useQuery(
    trpc.project.forChat.queryOptions({ id: conversation.id })
  );
  const [selectedProjectId, setSelectedProjectId] = useState<string>();
  const projectId = selectedProjectId ?? assigned.data?.id ?? "";
  const projects = useQuery(trpc.project.list.queryOptions());
  const move = useMutation(
    trpc.project.assign.mutationOptions({
      onSuccess: async () => {
        await cache.invalidateQueries({
          queryKey: trpc.project.forChat.pathKey(),
        });
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
    !projectId ||
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
          onChange={(event: {
            readonly target: { readonly value: string };
          }) => {
            setSelectedProjectId(event.target.value);
          }}
          value={projectId}
        >
          <option value="">No project</option>
          {!(available === true) && (
            <option disabled value={projectId}>
              Project unavailable
            </option>
          )}
          {projects.data?.map(
            (project: {
              readonly id: string;
              readonly name: string;
            }): React.JSX.Element => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            )
          )}
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
              [
                move.isPending,
                assigned.isPending,
                assigned.isError,
                projects.isPending,
                projects.isError,
              ].includes(true) ||
              !(available === true) ||
              projectId === (assigned.data?.id ?? "")
            }
            onClick={() => {
              move.mutate({
                conversationId: conversation.id,
                projectId: projectId || null,
              });
            }}
          >
            {move.isPending ? "Moving…" : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
