import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import nodePath from "node:path";

import { expect, test } from "vitest";

import { fenceLocalEveSandboxMutations } from "./local-sandbox-fence";

test("fences every member before checking pending operations and never expires unresolved work", async () => {
  const appRoot = await mkdtemp(nodePath.join(tmpdir(), "eve-family-fence-"));
  const scope = (id: string) =>
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
