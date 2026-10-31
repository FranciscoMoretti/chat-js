"use client";

import { eveToolUIState } from "@/lib/eve/tool-ui-state";
import { createElement } from "react";

import { getEveInstalledToolRenderer } from "@/lib/ai/tool-renderer-registry";
import type { ReadonlyEveMessagePart } from "@/lib/eve/readonly-message-types";
import { toolOutputSchema } from "@/lib/eve/tool-result";

export const EveToolResult = ({
  part,
  messageId,
  isReadonly,
}: {
  readonly part: Extract<ReadonlyEveMessagePart, { readonly type: "tool" }>;
  readonly messageId: string;
  readonly isReadonly: boolean;
}) => {
  const Renderer = getEveInstalledToolRenderer(`tool-${part.name}`);
  if (!Renderer) {
    return null;
  }
  const presentation = {
    ...part,
    toolCallId: part.callId,
    toolName: part.name,
    state: eveToolUIState(part.state),
    errorText: part.error?.message,
  };
  const platformOutput =
    part.state === "completed" ? toolOutputSchema.safeParse(part.output) : null;
  if (
    platformOutput?.success === true &&
    platformOutput.data.status === "error"
  ) {
    return createElement(Renderer, {
      isReadonly,
      messageId,
      tool: {
        ...presentation,
        errorText: platformOutput.data.error,
        state: "output-error",
        updates: platformOutput.data.updates,
      },
    });
  }
  const tool =
    platformOutput?.success === true
      ? {
          ...presentation,
          output: platformOutput.data.output,
          updates: platformOutput.data.updates,
        }
      : presentation;
  return createElement(Renderer, { isReadonly, messageId, tool });
};
