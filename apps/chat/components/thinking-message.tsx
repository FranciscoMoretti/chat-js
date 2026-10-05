import React from "react";
/* oxlint-disable react/jsx-no-literals -- ThinkingMessage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

export const ThinkingMessage = (): React.JSX.Element => {
  const role = "assistant";

  return (
    <div
      className="group/message mx-auto w-full max-w-3xl px-4"
      data-role={role}
      data-testid="message-assistant-loading"
    >
      <div className="bg-muted-foreground m-1.5 size-3 animate-[pulse-dot_2s_ease-in-out_infinite] rounded-full motion-reduce:animate-none">
        <span className="sr-only">Loading</span>
      </div>
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
