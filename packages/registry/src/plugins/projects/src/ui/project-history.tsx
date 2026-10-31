"use client";
import React from "react";
import { EveHistoryList } from "@/components/eve/eve-history-list";
import { useEveDeletion } from "@/components/eve/eve-deletion-provider";
import { useEveMetadataMutations } from "@/components/eve/use-eve-metadata-mutations";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { ProjectChatItem } from "./project-chat-item";
import { ChatActions } from "@/components/chat-slots";

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
        <Empty className="border p-6">
          <EmptyHeader>
            <EmptyTitle>No chats in this project</EmptyTitle>
            <EmptyDescription>
              Start a chat to keep conversations organized and re-use project
              knowledge.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      }
      renderItem={(item, index) => (
        <li key={item.id}>
          {index > 0 && <Separator />}
          <ProjectChatItem
            chat={item}
            onDelete={() => {
              openDeletion(item);
            }}
            pluginActions={<ChatActions chat={item} />}
            onRename={async (id, title) => {
              await rename.mutateAsync({ id, title });
            }}
          />
        </li>
      )}
    />
  );
};
