"use client";

import type { UseChatHelpers } from "@ai-sdk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { MultimodalInput } from "@/components/multimodal-input";
import { ProjectChats } from "@/components/project-chats";
import { ProjectConfig } from "@/components/project-config";
import {
  type ProjectDetailsData,
  ProjectDetailsDialog,
} from "@/components/project-details-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  useDeleteChat,
  useGetAllChats,
  useRenameChat,
  useRenameProject,
} from "@/hooks/chat-sync-hooks";
import type { ChatMessage } from "@/lib/ai/types";
import type { ProjectColorName, ProjectIconName } from "@/lib/project-icons";
import { useLastMessageId } from "@/lib/stores/hooks-base";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/trpc/react";

export function ProjectHome({
  chatId,
  projectId,
  status,
  className,
}: {
  chatId: string;
  projectId: string;
  status: UseChatHelpers<ChatMessage>["status"];
  className?: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const parentMessageId = useLastMessageId();
  const { data: project } = useQuery(
    trpc.project.getById.queryOptions({ id: projectId })
  );
  const { data: chats } = useGetAllChats({
    projectId,
  });
  const [instructionsDialogOpen, setInstructionsDialogOpen] = useState(false);
  const [instructionsValue, setInstructionsValue] = useState("");
  const [renameProjectDialogOpen, setRenameProjectDialogOpen] = useState(false);
  const shouldCenter = chats !== undefined && chats.length === 0;

  const { deleteChat } = useDeleteChat();
  const renameChatMutation = useRenameChat();
  const renameProjectMutation = useRenameProject();

  const setInstructionsMutation = useMutation(
    trpc.project.setInstructions.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.project.getById.queryKey({ id: projectId }),
        });
        setInstructionsDialogOpen(false);
      },
    })
  );

  const handleOpenInstructionsDialog = () => {
    setInstructionsValue(project?.instructions ?? "");
    setInstructionsDialogOpen(true);
  };

  const handleCloseInstructionsDialog = () => {
    setInstructionsDialogOpen(false);
    setInstructionsValue(project?.instructions ?? "");
  };

  const handleSaveInstructions = () => {
    setInstructionsMutation.mutate({
      id: projectId,
      instructions: instructionsValue,
    });
  };

  const handleRenameProject = async (data: ProjectDetailsData) => {
    await renameProjectMutation.mutateAsync({
      id: projectId,
      updates: {
        name: data.name,
        icon: data.icon,
        iconColor: data.color,
      },
    });
    queryClient.invalidateQueries({
      queryKey: trpc.project.getById.queryKey({ id: projectId }),
    });
  };

  const handleRenameChat = async (idToRename: string, title: string) => {
    await renameChatMutation.mutateAsync({
      chatId: idToRename,
      title,
    });
    toast.success("Chat renamed successfully");
  };

  return (
    <div
      className={cn("flex flex-1 justify-center overflow-y-auto", className)}
    >
      <div
        className={cn(
          "mx-auto flex h-full min-h-0 w-full flex-col p-2 @[500px]:px-4 @[500px]:pb-4 md:max-w-3xl @[500px]:md:pb-6",
          shouldCenter && "grid grid-rows-[1fr_auto_1fr]"
        )}
      >
        <div className={cn("space-y-4", shouldCenter ? "row-start-2" : "mt-4")}>
          <ProjectConfig
            instructions={project?.instructions}
            onEditInstructions={handleOpenInstructionsDialog}
            onRenameProject={() => setRenameProjectDialogOpen(true)}
            projectColor={project?.iconColor as ProjectColorName | undefined}
            projectIcon={project?.icon as ProjectIconName | undefined}
            projectName={project?.name}
          />

          <MultimodalInput
            autoFocus
            chatId={chatId}
            parentMessageId={parentMessageId}
            status={status}
          />
        </div>

        {chats !== undefined && (
          <div
            className={cn(
              shouldCenter ? "row-start-3 mt-6" : "mt-4 min-h-0 flex-1"
            )}
          >
            <ProjectChats
              chats={chats}
              onDelete={deleteChat}
              onRename={handleRenameChat}
            />
          </div>
        )}

        <Dialog
          onOpenChange={handleCloseInstructionsDialog}
          open={instructionsDialogOpen}
        >
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Set project instructions</DialogTitle>
              <DialogDescription>
                Provide relevant instructions and information for chats within{" "}
                {project?.name ?? "this project"}. This will work alongside user
                preferences and the selected style in a chat.
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <Textarea
                autoFocus
                className="min-h-[200px] resize-none"
                onChange={(e) => setInstructionsValue(e.target.value)}
                placeholder="Enter project instructions..."
                value={instructionsValue}
              />
            </div>
            <DialogFooter>
              <Button
                onClick={handleCloseInstructionsDialog}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button
                disabled={setInstructionsMutation.isPending}
                onClick={handleSaveInstructions}
                type="button"
              >
                {setInstructionsMutation.isPending
                  ? "Saving..."
                  : "Save instructions"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <ProjectDetailsDialog
          initialColor={project?.iconColor as ProjectColorName | undefined}
          initialIcon={project?.icon as ProjectIconName | undefined}
          initialName={project?.name}
          isLoading={renameProjectMutation.isPending}
          mode="edit"
          onOpenChange={setRenameProjectDialogOpen}
          onSubmit={handleRenameProject}
          open={renameProjectDialogOpen}
        />
      </div>
    </div>
  );
}
