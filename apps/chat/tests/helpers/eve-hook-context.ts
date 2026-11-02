import type { HookContext } from "eve/hooks";
import { testDynamicContext } from "./eve-dynamic-context";

const unexpected = (): never => {
  throw new Error("Unexpected hook action in test");
};
export const testHookContext = (
  overrides: Partial<HookContext<"*">> = {}
): HookContext<"*"> => ({
  ...testDynamicContext(),
  agent: { name: "chatjs" },
  position: { line: 0, index: 0 },
  occurrence: {
    idempotencyKey: "test",
    abortSignal: new AbortController().signal,
  },
  cancel: unexpected,
  continue: unexpected,
  getSandbox: unexpected,
  session: {
    id: "session",
    auth: { current: null, initiator: null },
    turn: { id: "turn_0", sequence: 0 },
  },
  ...overrides,
});
