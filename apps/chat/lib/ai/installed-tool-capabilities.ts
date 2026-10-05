interface CodeSandboxCleanupSession {
  deleteAndConfirmAbsent: (name: string) => Promise<void>;
  provider: { projectId: string; teamId: string };
}

interface CodeSandboxCleanupCapability {
  createCleanupSession: () => CodeSandboxCleanupSession;
}

const codeSandboxCleanup = Symbol("chatjs.code-sandbox-cleanup");

interface CodeSandboxCleanupTool {
  [codeSandboxCleanup]: CodeSandboxCleanupCapability;
}

const hasCodeSandboxCleanup = (tool: object): tool is CodeSandboxCleanupTool =>
  codeSandboxCleanup in tool;

/* oxlint-disable id-length, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types -- id-length (#506): withCodeSandboxCleanup uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
jsdoc/require-param (#534): withCodeSandboxCleanup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
jsdoc/require-returns (#535): withCodeSandboxCleanup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
typescript/prefer-readonly-parameter-types (#565): withCodeSandboxCleanup accepts capability: CodeSandboxCleanupCapability; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** Attach provider lifecycle behavior without changing the AI SDK Tool contract. */
const withCodeSandboxCleanup = <T extends object>(
  tool: T,
  capability: CodeSandboxCleanupCapability
): T => {
  Object.defineProperty(tool, codeSandboxCleanup, {
    configurable: false,
    enumerable: false,
    value: capability,
    writable: false,
  });
  return tool;
};
/* oxlint-enable id-length, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-undefined -- no-undefined (#519): getCodeSandboxCleanup uses undefined for absent or optional values; substituting null would alter its type and serialization contract. */
const getCodeSandboxCleanup = (
  tool: unknown
): CodeSandboxCleanupCapability | undefined => {
  if (
    tool === null ||
    (typeof tool !== "object" && typeof tool !== "function")
  ) {
    return;
  }
  // oxlint-disable-next-line typescript/consistent-return -- #580: getCodeSandboxCleanup has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
  return hasCodeSandboxCleanup(tool) ? tool[codeSandboxCleanup] : undefined;
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getCodeSandboxCleanup, withCodeSandboxCleanup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable no-undefined */
export { getCodeSandboxCleanup, withCodeSandboxCleanup };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (CodeSandboxCleanupCapability, CodeSandboxCleanupSession); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { CodeSandboxCleanupCapability, CodeSandboxCleanupSession };
/* oxlint-enable import/no-named-export */
