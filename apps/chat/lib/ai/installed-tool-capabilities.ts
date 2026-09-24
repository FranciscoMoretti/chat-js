export interface CodeSandboxCleanupSession {
  deleteAndConfirmAbsent: (name: string) => Promise<void>;
  provider: { projectId: string; teamId: string };
}

export interface CodeSandboxCleanupCapability {
  createCleanupSession: () => CodeSandboxCleanupSession;
}

const codeSandboxCleanup = Symbol("chatjs.code-sandbox-cleanup");

interface CodeSandboxCleanupTool {
  [codeSandboxCleanup]: CodeSandboxCleanupCapability;
}

const hasCodeSandboxCleanup = (tool: object): tool is CodeSandboxCleanupTool =>
  codeSandboxCleanup in tool;

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

export const getCodeSandboxCleanup = (
  tool: unknown
): CodeSandboxCleanupCapability | undefined => {
  if (
    tool === null ||
    (typeof tool !== "object" && typeof tool !== "function")
  ) {
    return;
  }
  return hasCodeSandboxCleanup(tool) ? tool[codeSandboxCleanup] : undefined;
};
