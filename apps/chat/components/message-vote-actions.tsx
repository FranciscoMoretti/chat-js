import { ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { MessageAction } from "./ai-elements/message";

export function MessageVoteActions({
  vote,
  disabled = false,
  onVote,
}: {
  vote?: { isUpvoted: boolean };
  disabled?: boolean;
  onVote: (type: "up" | "down") => Promise<unknown>;
}) {
  return (
    <>
      <MessageAction
        aria-pressed={vote ? !vote.isUpvoted : false}
        className="pointer-events-auto! h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        data-testid="message-downvote"
        disabled={disabled || vote?.isUpvoted === false}
        onClick={() => {
          toast.promise(onVote("down"), {
            loading: "Downvoting Response...",
            success: "Downvoted Response!",
            error: "Failed to downvote response.",
          });
        }}
        tooltip="Downvote Response"
      >
        <ThumbsDown size={14} />
      </MessageAction>
      <MessageAction
        aria-pressed={vote?.isUpvoted ?? false}
        className="pointer-events-auto! h-7 w-7 p-0 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        data-testid="message-upvote"
        disabled={disabled || vote?.isUpvoted === true}
        onClick={() => {
          toast.promise(onVote("up"), {
            loading: "Upvoting Response...",
            success: "Upvoted Response!",
            error: "Failed to upvote response.",
          });
        }}
        tooltip="Upvote Response"
      >
        <ThumbsUp size={14} />
      </MessageAction>
    </>
  );
}
