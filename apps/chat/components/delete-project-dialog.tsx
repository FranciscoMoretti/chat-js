"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useCallback } from "react";
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
  deleteId: string | null;
  setShowDeleteDialog: (show: boolean) => void;
  showDeleteDialog: boolean;
}

export const DeleteProjectDialog = ({
  deleteId,
  showDeleteDialog,
  setShowDeleteDialog,
}: DeleteProjectDialogProps) => {
  const trpc = useTRPC();
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();

  const deleteMutation = useMutation(
    trpc.project.remove.mutationOptions({
      onError: () => {
        toast.error("Failed to delete project");
      },
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.project.list.queryKey(),
        });
        toast.success("Project deleted");
      },
    })
  );

  const handleDelete = useCallback(async () => {
    if (!deleteId) {
      return;
    }
    try {
      await deleteMutation.mutateAsync({ id: deleteId });
    } catch {
      // error surfaced via onError above
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

  return (
    <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this project?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the
            project and its associations.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
