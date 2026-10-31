import type { EveToolPart } from "eve/client";
import type { ToolUIPart } from "ai";

const states = {
  streaming: "input-streaming",
  approval: "approval-requested",
  blocked: "approval-requested",
  completed: "output-available",
  rejected: "output-denied",
  failed: "output-error",
  cancelled: "output-error",
  requested: "input-available",
  running: "input-available",
} satisfies Record<EveToolPart["state"], ToolUIPart["state"]>;

/** Registry renderers consume the AI SDK presentation contract. */
export const eveToolUIState = (
  state: EveToolPart["state"]
): ToolUIPart["state"] => states[state];
