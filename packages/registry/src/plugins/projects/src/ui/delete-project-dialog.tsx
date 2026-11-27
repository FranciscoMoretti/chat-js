"use client";

import React, { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import type { JSX as ReactJSX } from "react";

import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useTRPC } from "@/trpc/react";

interface DeleteProjectDialogProps {
  readonly deleteId: string | null;
  readonly setShowDeleteDialog: (show: boolean) => void;
  readonly showDeleteDialog: boolean;
}

export const DeleteProjectDialog = ({
  deleteId,
  showDeleteDialog,
  setShowDeleteDialog,
}: DeleteProjectDialogProps): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.project.remove.mutationOptions({
      onSuccess: async (_project, { id }) => {
        const path = globalThis.location.pathname;
        const projectPath = `/project/${id}`;
        if (path === projectPath || path.startsWith(`${projectPath}/`)) {
          router.replace("/");
        }
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.project.getById.queryKey({ id }),
            refetchType: "none",
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.project.list.pathKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.project.forChat.pathKey(),
          }),
          queryClient.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
          queryClient.invalidateQueries({ queryKey: trpc.eve.get.pathKey() }),
        ]);
        toast.success("Project deleted");
      },
    })
  );
  const handleDelete = useCallback(async () => {
    if (!(typeof deleteId === "string" && deleteId !== "")) {
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
    } catch {
      // Keep the dialog and route available for retry.
      return;
    }

    setShowDeleteDialog(false);
  }, [deleteId, deleteMutation, setShowDeleteDialog]);
  return (
    <AlertDialog
      onOpenChange={(open) => {
        if (!deleteMutation.isPending) {
          setShowDeleteDialog(open);
        }
      }}
      open={showDeleteDialog}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            project and its associations.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {deleteMutation.error && (
          <p role="alert">Could not delete project. Try again.</p>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleteMutation.isPending}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={deleteMutation.isPending}

            onClick={(event: { readonly preventDefault: () => void }) => {
              event.preventDefault();
              startEventAction(handleDelete);
            }}
          >
            {deleteMutation.isPending ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
