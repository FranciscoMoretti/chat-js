import { getPersistentSandboxProvider } from "../lib/sandbox/runtime";
import { stopDevelopmentPersistentSandboxes } from "../lib/eve/persistent-sandbox-store";
import { z } from "zod";

const stop = async (): Promise<void> => {
  try {
    const runId = z.uuid().parse(process.argv[2]);
    await stopDevelopmentPersistentSandboxes(
      runId,
      getPersistentSandboxProvider
    );
    // The app DB pools otherwise keep this one-shot supervisor command alive.
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
};
void stop();
