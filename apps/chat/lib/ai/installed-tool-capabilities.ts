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

/** Attach provider lifecycle behavior without changing the AI SDK Tool contract.
 * @template {object} Tool
 * @param {Tool} tool Caller-owned tool that receives the non-enumerable lifecycle property.
 * @param {Readonly<CodeSandboxCleanupCapability>} capability Cleanup-session factory retained as the attached property value.
 * @returns {Tool} The original tool instance, preserving its concrete type and identity.
 */
const withCodeSandboxCleanup = <Tool extends object>(
  tool: Tool,
  capability: Readonly<CodeSandboxCleanupCapability>
): Tool => {
  Object.defineProperty(tool, codeSandboxCleanup, {
    configurable: false,
    enumerable: false,
    value: capability,
    writable: false,
  });
  return tool;
};

const getCodeSandboxCleanup = (
  tool: unknown
): CodeSandboxCleanupCapability | undefined => {
  if (
    tool === null ||
    (typeof tool !== "object" && typeof tool !== "function")
  ) {
    return;
  }
  if (hasCodeSandboxCleanup(tool)) {
    // oxlint-disable-next-line typescript/consistent-return -- #580: getCodeSandboxCleanup has an optional result; absent or inapplicable records intentionally return undefined rather than a fabricated value.
    return tool[codeSandboxCleanup];
  }
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (getCodeSandboxCleanup, withCodeSandboxCleanup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export { getCodeSandboxCleanup, withCodeSandboxCleanup };
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (CodeSandboxCleanupCapability, CodeSandboxCleanupSession); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { CodeSandboxCleanupCapability, CodeSandboxCleanupSession };
/* oxlint-enable import/no-named-export */
