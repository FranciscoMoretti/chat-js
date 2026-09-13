"use client";

import { useRouter } from "next/navigation";
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
import { useDeleteChat } from "@/hooks/chat-sync-hooks";
import { useCurrentChatRoute } from "@/lib/chat-route";

interface DeleteChatDialogProps {
  deleteId: string | null;
  setShowDeleteDialog: (show: boolean) => void;
  showDeleteDialog: boolean;
}

export function DeleteChatDialog({
  deleteId,
  showDeleteDialog,
  setShowDeleteDialog,
}: DeleteChatDialogProps) {
  const currentRoute = useCurrentChatRoute();
  const router = useRouter();
  const { deleteChat } = useDeleteChat();

  const handleDelete = useCallback(async () => {
    if (!deleteId) {
      return;
    }

    try {
      await deleteChat(deleteId, {
        onSuccess: () => toast.success("Chat deleted successfully"),
        onError: () => toast.error("Failed to delete chat"),
      });
    } catch (_error) {
      // Error already handled by onError callback
    }

    setShowDeleteDialog(false);

    if (
      deleteId === currentRoute.id &&
      (currentRoute.type === "chat" || currentRoute.type === "projectChat")
    ) {
      if (currentRoute.source === "project" && currentRoute.projectId) {
        router.push(`/project/${currentRoute.projectId}`);
      } else {
        router.push("/");
      }
    }
  }, [
    deleteId,
    deleteChat,
    currentRoute.id,
    currentRoute.projectId,
    currentRoute.source,
    currentRoute.type,
    router,
    setShowDeleteDialog,
  ]);

  return (
    <AlertDialog onOpenChange={setShowDeleteDialog} open={showDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete your chat
            and remove it from our servers.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
