import type { ToolContext } from "eve/tools";

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep unexpected's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const unexpected = () => {
  throw new Error("Unexpected native resource access in test");
};
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-disable typescript/prefer-readonly-parameter-types, unicorn/no-null --
 * typescript/prefer-readonly-parameter-types (#565): testToolContext accepts overrides: Partial<ToolContext> = {}; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): testToolContext preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics.
 */
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
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */
