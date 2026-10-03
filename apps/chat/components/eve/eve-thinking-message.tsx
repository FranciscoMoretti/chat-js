import type { EveMessage } from "eve/client";
import React from "react";

import { ThinkingMessage } from "@/components/thinking-message";

/* oxlint-disable import/no-named-export, import/prefer-default-export, no-magic-numbers, no-ternary, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveThinkingMessage: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; oxc/no-optional-chaining: optional access preserves the absent prop, query result, or browser capability fallback (including latest?.role); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including part); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveThinkingMessage = ({
  status,
  messages,
}: {
  status: string;
  messages: readonly EveMessage[];
}) => {
  if (status !== "submitted" && status !== "streaming") {
    return null;
  }
  const latest = messages.at(-1);
  // Eve opens the stream before the assistant has any visible content.
  const hasContent =
    latest?.role === "assistant" &&
    latest.parts.some((part) =>
      part.type === "text"
        ? Boolean(part.text.trim())
        : part.type !== "step-start"
    );
  return status === "submitted" || !hasContent ? <ThinkingMessage /> : null;
};
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-magic-numbers, no-ternary, oxc/no-optional-chaining, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */
