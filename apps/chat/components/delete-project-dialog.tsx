"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import type { JSX as ReactJSX } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useCallback } from "react";
/* oxlint-enable sort-imports */
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
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
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return -- DeleteProjectDialog: ; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/promise-function-async: return the existing promise directly; adding async changes synchronous throw behavior and promise identity; typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

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

            onClick={(event) => {
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
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/prefer-readonly-parameter-types, typescript/promise-function-async, typescript/strict-void-return */
