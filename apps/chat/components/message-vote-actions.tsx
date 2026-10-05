import { ThumbsDown, ThumbsUp } from "lucide-react";
import React from "react";
import { toast } from "sonner";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { MessageAction } from "./ai-elements/message";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (MessageVoteActions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- MessageVoteActions: ; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const MessageVoteActions = ({
  vote,
  disabled = false,
  onVote,
}: {
  readonly vote?: { readonly isUpvoted: boolean };
  readonly disabled?: boolean;
  readonly onVote: (type: "up" | "down") => Promise<unknown>;
}): React.JSX.Element => (
  <>
    <MessageAction
      aria-pressed={vote ? !vote.isUpvoted : false}
      // oxlint-disable-next-line react/forbid-component-props -- MessageAction accepts className in its styling contract; preserve this caller's layout and appearance.
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
      // oxlint-disable-next-line react/forbid-component-props -- MessageAction accepts className in its styling contract; preserve this caller's layout and appearance.
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
