/* oxlint-disable import/no-nodejs-modules --
 * import/no-nodejs-modules (#529): This test harness requires import { createHash } from "node:crypto";; import { mkdir, mkdtemp, readFile, rm, utimes, writeFile, } from "node:fs/promises";; import { tmpdir } from "node:os";; import nodePath from "node:path";; its Node runtime boundary deliberately permits these built-ins.
 */
import { createHash } from "node:crypto";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
/* oxlint-enable sort-imports */
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import nodePath from "node:path";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { expect, test } from "vitest";
/* oxlint-enable sort-imports */

import { fenceLocalEveSandboxMutations } from "./local-sandbox-fence";
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable max-statements, no-magic-numbers, unicorn/max-nested-calls --
 * max-statements (#512): test("fences every member before checking pending operations and never expires unreso keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-magic-numbers (#517): test("fences every member before checking pending operations and never expires unreso uses 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * unicorn/max-nested-calls (#568): test("fences every member before checking pending operations and never expires unreso keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
test("fences every member before checking pending operations and never expires unresolved work", async () => {
  const appRoot = await mkdtemp(nodePath.join(tmpdir(), "eve-family-fence-"));
  const scope = (id: string): string =>
    nodePath.join(
      appRoot,
      ".eve",
      "sandbox-mutations",
      createHash("sha256").update(id).digest("hex")
    );
  const lease = nodePath.join(scope("first"), "operations", "operation.json");
  try {
    await mkdir(nodePath.join(scope("first"), "operations"), {
      recursive: true,
    });
    await writeFile(lease, '{"version":1,"pid":1}');
    await utimes(lease, new Date(0), new Date(0));
    await expect(
      fenceLocalEveSandboxMutations(appRoot, ["first", "second"])
    ).rejects.toThrow("still pending");
    for (const id of ["first", "second"]) {
      // oxlint-disable-next-line eslint/no-await-in-loop -- Each case completes before the shared fixture or mock state is reused.
      expect(await readFile(nodePath.join(scope(id), "deleted"), "utf-8")).toBe(
        "1\n"
      );
    }
    expect(await readFile(lease, "utf-8")).toContain('"pid":1');
    await rm(lease);
    await fenceLocalEveSandboxMutations(appRoot, ["first", "second", "first"]);
    await fenceLocalEveSandboxMutations(appRoot, ["first", "second"]);
    await expect(
      readFile(nodePath.join(scope("unrelated"), "deleted"))
    ).rejects.toMatchObject({ code: "ENOENT" });
  } finally {
    await rm(appRoot, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-statements, no-magic-numbers, unicorn/max-nested-calls */
