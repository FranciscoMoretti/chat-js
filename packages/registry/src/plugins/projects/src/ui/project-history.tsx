"use client";
import React from "react";
import { EveHistoryList } from "@/components/eve/eve-history-list";
import { EveShareDialogContent } from "@/components/eve/eve-share-dialog";
import { useEveDeletion } from "@/components/eve/eve-deletion-provider";
import { useEveMetadataMutations } from "@/components/eve/use-eve-metadata-mutations";
import { Separator } from "@/components/ui/separator";
import { ProjectChatItem } from "./project-chat-item";
import { ProjectChatActions } from "./chat-contributions";

export const ProjectHistory = ({
  projectId,
  ...props
}: Omit<
  React.ComponentProps<typeof EveHistoryList>,
  "input" | "renderItem" | "empty"
> & { readonly projectId: string }): React.JSX.Element => {
  const openDeletion = useEveDeletion();
  const { rename } = useEveMetadataMutations();
  return (
    <EveHistoryList
      {...props}
      input={{ projectId, search: "" }}
      empty={
        <div className="border-border/60 rounded-xl border px-4 py-6">
          <p className="text-foreground text-sm font-medium">
            No chats in this project
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            Start a chat to keep conversations organized and re-use project
            knowledge.
          </p>
        </div>
      }
      renderItem={(item, index) => (
        <li key={item.id}>
          {index > 0 && <Separator />}
          <ProjectChatItem
            chat={item}
            onDelete={() => {
              openDeletion(item);
            }}
            pluginActions={<ProjectChatActions chat={item} />}
            onRename={async (id, title) => {
              await rename.mutateAsync({ id, title });
            }}
            renderShareContent={(_id, onClose) => (
              <EveShareDialogContent
                chatId={item.conversationId}
                onClose={onClose}
              />
            )}
          />
        </li>
      )}
    />
  );
};
