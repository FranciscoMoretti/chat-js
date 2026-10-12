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
    return undefined;
  }
  if (hasCodeSandboxCleanup(tool)) {
    return tool[codeSandboxCleanup];
  }
  return undefined;
};
export { getCodeSandboxCleanup, withCodeSandboxCleanup };
export type { CodeSandboxCleanupCapability, CodeSandboxCleanupSession };
