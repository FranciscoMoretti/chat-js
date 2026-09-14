import { memo } from "react";

import { MessageSiblingsView } from "@/components/message-siblings-view";
import { useNavigateToSibling } from "@/hooks/use-navigate-to-sibling";
import { useMessageRoleById } from "@/lib/stores/hooks-base";
import {
  useMessageSiblingInfo,
  useParallelGroupInfo,
} from "@/lib/stores/hooks-threads";

const PureMessageSiblings = ({
  messageId,
  isReadOnly: _isReadOnly,
}: {
  messageId: string;
  isReadOnly: boolean;
}) => {
  const role = useMessageRoleById(messageId);
  const siblingInfo = useMessageSiblingInfo(messageId);
  const parallelGroupInfo = useParallelGroupInfo(messageId);
  const navigateToSibling = useNavigateToSibling();

  // Hide sibling nav for assistant messages in a parallel group — those use
  // the response cards for navigation. User messages should always show
  // sibling nav even when they spawned parallel responses.
  if (parallelGroupInfo && role === "assistant") {
    return null;
  }

  return (
    <MessageSiblingsView
      count={siblingInfo?.siblings.length ?? 0}
      index={siblingInfo?.siblingIndex ?? 0}
      onNext={() => navigateToSibling(messageId, "next")}
      onPrevious={() => navigateToSibling(messageId, "prev")}
    />
  );
};

export const MessageSiblings = memo(PureMessageSiblings);
