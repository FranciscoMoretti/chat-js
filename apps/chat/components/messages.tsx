import { memo } from "react";
import {
  Conversation,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ConversationContent } from "@/components/ai-elements/extra/conversation-content-scroll-area";
import { useChatId, useChatStatus } from "@/lib/stores/base";
import { useMessageIds } from "@/lib/stores/hooks-base";
import { cn } from "@/lib/utils";
import { Greeting } from "./greeting";
import { PreviewMessage } from "./message";
import { ResponseErrorMessage } from "./response-error-message";
import { ThinkingMessage } from "./thinking-message";

interface PureMessagesInternalProps {
  isReadonly: boolean;
}

const PureMessagesInternal = memo(
  ({ isReadonly }: PureMessagesInternalProps) => {
    const chatId = useChatId();
    const status = useChatStatus();
    const messageIds = useMessageIds();

    if (!chatId) {
      return null;
    }

    if (messageIds.length === 0) {
      return <Greeting />;
    }

    return (
      <>
        {messageIds.map((messageId, index) => (
          <PreviewMessage
            isLoading={
              status === "streaming" && messageIds.length - 1 === index
            }
            isReadonly={isReadonly}
            key={messageId}
            messageId={messageId}
            parentMessageId={index > 0 ? messageIds[index - 1] : null}
          />
        ))}

        {status === "submitted" && messageIds.length > 0 && (
          // messages[messages.length - 1].role === 'user' &&
          <ThinkingMessage />
        )}

        {status === "error" && <ResponseErrorMessage />}
      </>
    );
  }
);

interface MessagesProps {
  className?: string;
  isReadonly: boolean;
  onModelChange?: (modelId: string) => void;
}

function PureMessages({ isReadonly, className }: MessagesProps) {
  return (
    <Conversation className={cn("h-full w-full overflow-hidden", className)}>
      <ConversationContent
        className={cn(
          "container mx-auto w-full pb-10 sm:max-w-2xl md:max-w-3xl",
          className
        )}
      >
        <PureMessagesInternal isReadonly={isReadonly} />
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  );
}

export const Messages = memo(PureMessages, (prevProps, nextProps) => {
  if (prevProps.isReadonly !== nextProps.isReadonly) {
    return false;
  }

  return true;
});
