/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): CodeSandboxCleanupSession is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): CodeSandboxCleanupSession stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CodeSandboxCleanupSession API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export interface CodeSandboxCleanupSession {
  deleteAndConfirmAbsent: (name: string) => Promise<void>;
  provider: { projectId: string; teamId: string };
}
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): CodeSandboxCleanupCapability is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): CodeSandboxCleanupCapability stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named CodeSandboxCleanupCapability API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export interface CodeSandboxCleanupCapability {
  createCleanupSession: () => CodeSandboxCleanupSession;
}
/* oxlint-enable import/exports-last, import/group-exports */

const codeSandboxCleanup = Symbol("chatjs.code-sandbox-cleanup");

interface CodeSandboxCleanupTool {
  [codeSandboxCleanup]: CodeSandboxCleanupCapability;
}

const hasCodeSandboxCleanup = (tool: object): tool is CodeSandboxCleanupTool =>
  codeSandboxCleanup in tool;

/* oxlint-disable id-length, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types  --
 * id-length (#506): withCodeSandboxCleanup uses T as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): withCodeSandboxCleanup stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named withCodeSandboxCleanup API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * jsdoc/require-param (#534): withCodeSandboxCleanup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): withCodeSandboxCleanup's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * typescript/prefer-readonly-parameter-types (#565): withCodeSandboxCleanup accepts capability: CodeSandboxCleanupCapability; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** Attach provider lifecycle behavior without changing the AI SDK Tool contract. */
export const withCodeSandboxCleanup = <T extends object>(
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
/* oxlint-enable id-length, import/group-exports, jsdoc/require-param, jsdoc/require-returns, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, no-undefined  --
 * import/group-exports (#523): getCodeSandboxCleanup stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named getCodeSandboxCleanup API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-ternary (#518): getCodeSandboxCleanup derives branch values with conditional expressions; the enabled prefer-ternary rule also favors this form over assignment-only if statements.
 * no-undefined (#519): getCodeSandboxCleanup uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 */
export const getCodeSandboxCleanup = (
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
/* oxlint-enable import/group-exports, no-undefined */
