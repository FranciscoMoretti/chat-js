import type { ToolContext } from "eve/tools";

/* oxlint-disable typescript/explicit-function-return-type --
 * typescript/explicit-function-return-type (#560): Keep unexpected's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 */
const unexpected = () => {
  throw new Error("Unexpected native resource access in test");
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (testToolContext); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing overrides own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  ...overrides,
});
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/prefer-readonly-parameter-types, unicorn/no-null */
