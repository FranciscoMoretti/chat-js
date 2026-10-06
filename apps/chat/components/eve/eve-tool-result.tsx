"use client";

import type { EveMessagePart } from "eve/client";
import { createElement } from "react";

import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { toolOutputSchema } from "@/lib/eve/tool-result";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (EveToolResult); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- EveToolResult: ; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including platformOutput?.success); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const EveToolResult = ({
  part,
  messageId,
  isReadonly,
}: {
  part: Extract<EveMessagePart, { type: "dynamic-tool" }>;
  messageId: string;
  isReadonly: boolean;
}) => {
  const Renderer = getEveInstalledToolRenderer(`tool-${part.toolName}`);
  if (!Renderer) {
    return null;
  }
  const platformOutput =
    // oxlint-disable-next-line no-ternary -- Keep platformOutput as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    part.state === "output-available"
      ? toolOutputSchema.safeParse(part.output)
      : null;
  // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading success from platformOutput; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.
  if (platformOutput?.success && platformOutput.data.status === "error") {
    return createElement(Renderer, {
      isReadonly,
      messageId,
      tool: {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing part own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...part,
        errorText: platformOutput.data.error,
        state: "output-error",
        updates: platformOutput.data.updates,
      },
    });
  }
  // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading success from platformOutput; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep tool as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const tool = platformOutput?.success
    ? {
        // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing part own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
        ...part,
        output: platformOutput.data.output,
        updates: platformOutput.data.updates,
      }
    : part;
  return createElement(Renderer, { isReadonly, messageId, tool });
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
