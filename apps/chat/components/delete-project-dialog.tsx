"use client";

import React, { useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";

import type { JSX as ReactJSX } from "react";

import { toast } from "sonner";

/* oxlint-disable sort-imports -- The combined development and production module-effect trace rejects swapping sonner and @/components/ui/alert-dialog; keep this adjacent import pair ordered. */
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
/* oxlint-enable sort-imports */

import { useTRPC } from "@/trpc/react";

interface DeleteProjectDialogProps {
  readonly deleteId: string | null;
  readonly setShowDeleteDialog: (show: boolean) => void;
  readonly showDeleteDialog: boolean;
}
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (DeleteProjectDialog); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- DeleteProjectDialog renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth -- DeleteProjectDialog: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; adding async changes synchronous throw behavior and promise identity */

export const DeleteProjectDialog = ({
  deleteId,
  showDeleteDialog,
  setShowDeleteDialog,
}: DeleteProjectDialogProps): ReactJSX.Element => {
  const [, startEventAction] = React.useTransition();
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteMutation's awaited sequencing and rejected-Promise behavior. */
  const deleteMutation = useMutation(
    trpc.project.remove.mutationOptions({
      onError: () => {
        toast.error("Failed to delete project");
      },
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.project.list.queryKey(),
          }),
          queryClient.invalidateQueries({ queryKey: trpc.eve.list.pathKey() }),
        ]);
        toast.success("Project deleted");
      },
    })
  );
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleDelete's awaited sequencing and rejected-Promise behavior. */
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

    // If we are inside this project's route, navigate home
    const inProjectRoute =
      typeof pathname === "string" &&
      (pathname === `/project/${deleteId}` ||
        pathname.startsWith(`/project/${deleteId}/`));
    if (inProjectRoute) {
      router.push("/");
    }
  }, [deleteId, deleteMutation, pathname, router, setShowDeleteDialog]);
  /* oxlint-enable oxc/no-async-await */
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
            {
              // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
              deleteMutation.isPending ? "Deleting..." : "Delete"
            }
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth */
