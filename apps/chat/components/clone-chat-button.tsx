"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CloneChatButtonView } from "@/components/clone-chat-button-view";
import { useCloneChat } from "@/hooks/chat-sync-hooks";

interface CloneChatButtonProps {
  chatId: string;
  className?: string;
}

export const CloneChatButton = ({
  chatId,
  className,
}: CloneChatButtonProps) => {
  const router = useRouter();
  const copyChat = useCloneChat();

  const handleCloneChat = async () => {
    try {
      const result = await copyChat.mutateAsync({
        chatId,
      });

      router.push(`/chat/${result.chatId}`);
      toast.success("Chat saved to your chats!");
    } catch {
      toast.error("Failed to save chat. Please try again.");
    }
  };

  return (
    <CloneChatButtonView
      className={className}
      isPending={copyChat.isPending}
      onClick={handleCloneChat}
    />
  );
};
