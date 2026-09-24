import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";

import { MessageAction } from "./ai-elements/message";

export const MessageVoteActions = ({
  vote,
  disabled = false,
  onVote,
}: {
  vote?: { isUpvoted: boolean };
  disabled?: boolean;
  onVote: (type: "up" | "down") => Promise<unknown>;
}) => (
  <>
    <MessageAction
      aria-pressed={vote ? !vote.isUpvoted : false}
      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground pointer-events-auto! h-7 w-7 p-0"
      data-testid="message-downvote"
      disabled={disabled || vote?.isUpvoted === false}
      onClick={() => {
        toast.promise(onVote("down"), {
          error: "Failed to downvote response.",
          loading: "Downvoting Response...",
          success: "Downvoted Response!",
        });
      }}
      tooltip="Downvote Response"
    >
      <ThumbsDown size={14} />
    </MessageAction>
    <MessageAction
      aria-pressed={vote?.isUpvoted ?? false}
      className="text-muted-foreground hover:bg-accent hover:text-accent-foreground pointer-events-auto! h-7 w-7 p-0"
      data-testid="message-upvote"
      disabled={disabled || vote?.isUpvoted === true}
      onClick={() => {
        toast.promise(onVote("up"), {
          error: "Failed to upvote response.",
          loading: "Upvoting Response...",
          success: "Upvoted Response!",
        });
      }}
      tooltip="Upvote Response"
    >
      <ThumbsUp size={14} />
    </MessageAction>
  </>
);
