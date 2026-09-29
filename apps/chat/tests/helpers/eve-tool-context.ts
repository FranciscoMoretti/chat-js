import type { ToolContext } from "eve/tools";

const unexpected = () => {
  throw new Error("Unexpected native resource access in test");
};
export const testToolContext = (
  overrides: Partial<ToolContext> = {}
): ToolContext => ({
  abortSignal: new AbortController().signal,
  callId: "test",
  getSandbox: unexpected,
  getSkill: unexpected,
  getToken: unexpected,
  requireAuth: unexpected,
  session: {
    auth: { current: null, initiator: null },
    id: "test",
    turn: { id: "turn", sequence: 0 },
  },
  toolName: "test",
  ...overrides,
});
