import { getPersistentSandboxProvider } from "../lib/sandbox/runtime";
import { stopDevelopmentPersistentSandboxes } from "../lib/eve/persistent-sandbox-store";
import { z } from "zod";

const stop = async (): Promise<void> => {
  try {
    const runId = z.uuid().parse(process.argv[2]);
    const { deferredWorkspaceIds } = await stopDevelopmentPersistentSandboxes(
      runId,
      getPersistentSandboxProvider
    );
    if (deferredWorkspaceIds.length > 0) {
      console.info(
        `Retained ${deferredWorkspaceIds.length} workspace(s) for native turn reconciliation after restart; delivery fences remain unchanged.`
      );
    }
    // The app DB pools otherwise keep this one-shot supervisor command alive.
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
void stop();
