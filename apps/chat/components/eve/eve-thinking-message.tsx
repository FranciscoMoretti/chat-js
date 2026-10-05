import type { EveMessage } from "eve/client";
import React from "react";
import type { JSX as ReactJSX } from "react";

import { ThinkingMessage } from "@/components/thinking-message";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveThinkingMessage); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EveThinkingMessage: ; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including -1); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including part); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveThinkingMessage = ({
  status,
  messages,
}: {
  status: string;
  messages: readonly EveMessage[];
}): ReactJSX.Element | null => {
  if (status !== "submitted" && status !== "streaming") {
    return null;
  }
  const latest = messages.at(-1);
  // Eve opens the stream before the assistant has any visible content.
  const hasContent =
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading role from latest; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
    latest?.role === "assistant" &&
    latest.parts.some((part) => {
      if (part.type === "text") {
        return Boolean(part.text.trim());
      }
      return part.type !== "step-start";
    });
  if (status === "submitted" || !hasContent) {
    return <ThinkingMessage />;
  }
  return null;
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types, unicorn/no-null */
