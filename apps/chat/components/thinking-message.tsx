import React from "react";
/* oxlint-disable import/no-named-export, import/prefer-default-export, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- ThinkingMessage: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

export const ThinkingMessage = () => {
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
/* oxlint-enable import/no-named-export, import/prefer-default-export, react/jsx-no-literals, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
