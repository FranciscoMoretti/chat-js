"use client";

import { Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
    } catch (error) {
      console.error("Failed to clone chat:", error);
      toast.error("Failed to save chat. Please try again.");
    }
  };

  return (
    <div className="m-auto flex w-fit items-center justify-center px-4 py-10">
      <Button
        className={className}
        disabled={copyChat.isPending}
        onClick={handleCloneChat}
        size="sm"
        type="button"
        variant="default"
      >
        {copyChat.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Copy className="mr-2 h-4 w-4" />
            Save to your chats
          </>
        )}
      </Button>
    </div>
  );
};
