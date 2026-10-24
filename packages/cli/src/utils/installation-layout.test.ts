import { rejects } from "node:assert/strict";
import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { planInstallation } from "./installation-plan";
import { syncPlugins } from "./sync-plugins";
import { syncTools } from "./sync-tools";

for (const marker of [
  "tools/chatjs/tools.ts",
  "tools/chatjs/custom-tools.ts",
  "tools/chatjs/custom-ui.ts",
  "features/mcp/chatjs.json",
  "features/installed.ts",
]) {
  test(`add and sync reject legacy ${marker} before changing registrations`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "chatjs-legacy-"));
    try {
      const file = path.join(root, marker);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, "user-owned legacy source");
      await rejects(
        planInstallation(root, { plugins: [], tools: [] }),
        /Legacy ChatJS installation layout/u
      );
      await rejects(syncTools(root), /Legacy ChatJS installation layout/u);
      await rejects(syncPlugins(root), /Legacy ChatJS installation layout/u);
      expect(await readFile(file, "utf-8")).toBe("user-owned legacy source");
      await rejects(
        readFile(path.join(root, "composition/generated/tools.ts")),
        { code: "ENOENT" }
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
