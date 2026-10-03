"use client";

import type { EveMessagePart } from "eve/client";
import { createElement } from "react";

import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import { toolOutputSchema } from "@/lib/eve/tool-result";
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
    part.state === "output-available"
      ? toolOutputSchema.safeParse(part.output)
      : null;
  if (platformOutput?.success && platformOutput.data.status === "error") {
    return createElement(Renderer, {
      isReadonly,
      messageId,
      tool: {
        ...part,
        errorText: platformOutput.data.error,
        state: "output-error",
        updates: platformOutput.data.updates,
      },
    });
  }
  const tool = platformOutput?.success
    ? {
        ...part,
        output: platformOutput.data.output,
        updates: platformOutput.data.updates,
      }
    : part;
  return createElement(Renderer, { isReadonly, messageId, tool });
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */
