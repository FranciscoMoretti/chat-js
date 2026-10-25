import { cp } from "node:fs/promises";
import path from "node:path";

/** Include the maintained supervisor in both packed and repository scaffolds. */
export const copyDevelopmentSupervisor = async (
  repository: string,
  destination: string
): Promise<void> => {
  await Promise.all(
    [
      "dev-supervisor.ts",
      "dev-process-tree.ts",
      "dev-health.ts",
      "dev-recovery.ts",
      "persistent-sandbox-cleanup.ts",
    ].map(async (file) => {
      await cp(
        path.join(repository, "scripts", file),
        path.join(
          destination,
          "scripts",
          file === "dev-supervisor.ts" ? "dev-supervisor.mts" : file
        )
      );
    })
  );
};
