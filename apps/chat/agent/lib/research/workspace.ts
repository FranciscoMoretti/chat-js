import type { WorkflowStepToolContext } from "eve/tools";
import type { SandboxSession } from "eve/sandbox";

type Context = Readonly<
  Pick<WorkflowStepToolContext, "callId" | "abortSignal"> & {
    getSandbox: () => PromiseLike<
      Pick<SandboxSession, "resolvePath" | "readTextFile" | "writeTextFile">
    >;
  }
>;

// Per-call paths keep follow-up research from overwriting an earlier report.
const researchPath = (callId: string, name: string): string => {
  if (!/^[a-z0-9-]+\.md$/u.test(name)) {
    throw new Error("Invalid research workspace filename.");
  }
  return `research/run-${encodeURIComponent(callId)}/${name}`;
};

// oxlint-disable-next-line eslint/func-style -- EVE durable steps require function declarations. Whole-file writes are safe to retry.
export async function writeResearchFile(
  context: Context,
  name: string,
  content: string
): Promise<string> {
  "use step";
  context.abortSignal.throwIfAborted();
  const sandbox = await context.getSandbox();
  const path = sandbox.resolvePath(researchPath(context.callId, name));
  await sandbox.writeTextFile({ path, content, signal: context.abortSignal });
  return path;
}

// oxlint-disable-next-line eslint/func-style -- Read the current workspace in a durable step, not during workflow replay.
export async function readResearchFiles(
  context: Context,
  names: readonly string[]
): Promise<string[]> {
  "use step";
  context.abortSignal.throwIfAborted();
  const sandbox = await context.getSandbox();
  return await Promise.all(
    names.map(async (name) => {
      const path = sandbox.resolvePath(researchPath(context.callId, name));
      const content = await sandbox.readTextFile({
        path,
        signal: context.abortSignal,
      });
      if (content === null) {
        throw new Error(
          `Research workspace file is no longer available: ${path}`
        );
      }
      return content;
    })
  );
}
