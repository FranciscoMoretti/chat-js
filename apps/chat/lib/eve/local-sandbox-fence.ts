import { createHash } from "node:crypto";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Permanently stop new local sandbox operations for an authorized native family.
 * Existing operation records must disappear before inventory and cleanup proceed.
 * Never expire or discard unresolved records on a timer: provider work may remain.
 */
export async function fenceLocalEveSandboxMutations(
  appRoot: string,
  sessionIds: string[]
) {
  const scopes = [...new Set(sessionIds)].map((id) =>
    join(
      appRoot,
      ".eve",
      "sandbox-mutations",
      createHash("sha256").update(id).digest("hex")
    )
  );
  for (const scope of scopes) {
    await mkdir(scope, { recursive: true });
    await writeFile(join(scope, "deleted"), "1\n", {
      flag: "wx",
      mode: 0o600,
    }).catch((error: unknown) => {
      if (
        !(error instanceof Error && "code" in error && error.code === "EEXIST")
      ) {
        throw error;
      }
    });
  }
  for (const scope of scopes) {
    const operations = await readdir(join(scope, "operations")).catch(
      (error: unknown) => {
        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "ENOENT"
        ) {
          return [];
        }
        throw error;
      }
    );
    if (operations.length) {
      throw new Error(
        "Sandbox operations are still pending. Resolve them before cleanup."
      );
    }
  }
}
