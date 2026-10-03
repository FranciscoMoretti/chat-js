import { ThumbsDown, ThumbsUp } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import { MessageAction } from "./ai-elements/message";
/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, typescript/prefer-readonly-parameter-types -- MessageVoteActions: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const MessageVoteActions = ({
  vote,
  disabled = false,
  onVote,
}: {
  vote?: { isUpvoted: boolean };
  disabled?: boolean;
  onVote: (type: "up" | "down") => Promise<unknown>;
}): React.JSX.Element => (
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
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, typescript/prefer-readonly-parameter-types */
