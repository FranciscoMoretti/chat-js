import { expect, it } from "bun:test";
import path from "node:path";
import { writeFile } from "node:fs/promises";
import { demoInstallation } from "../../registry/installation";
import { combinationCases } from "../../registry/scripts/installation-cases";
import { verifyInstallationParity } from "./installation-parity";
import { run } from "./run-command";

export const testFullInstallation = (root: string, cliEntry: string): void => {
  it("full installation: whole-tree parity, sync and provider replacement", async () => {
    const name = "full-installation";
    const cwd = path.join(root, name);
    const selection = demoInstallation;
    await run(root, [
      "node",
      cliEntry,
      "create",
      name,
      "--yes",
      "--no-electron",
      "--no-projects",
      "--no-mcp",
      "--no-documents",
      "--no-attachments",
      "--gateway",
      selection.gateway ?? "",
      "--storage-provider",
      selection.storage?.source ?? "",
      "--sandbox-provider",
      selection.sandbox ?? "",
    ]);
    await run(cwd, [
      "node",
      cliEntry,
      "add",
      ...selection.plugins,
      ...selection.tools,
      "--yes",
    ]);
    await verifyInstallationParity(cwd, selection, name);
    await run(cwd, ["node", cliEntry, "sync"]);
    await verifyInstallationParity(cwd, selection, name);
    await run(cwd, ["bun", "run", "test:types"]);
    await run(cwd, ["bun", "run", "db:generate", "--name=full_installation"]);
    await writeFile(
      path.join(cwd, "parity-environment.mjs"),
      `
process.env.AUTH_SECRET = "isolated-full-parity-fixture-auth-secret";
process.env.DATABASE_URL = "postgres://fixture:fixture@127.0.0.1:1/fixture";
process.env.WORKFLOW_POSTGRES_URL = process.env.DATABASE_URL;
process.env.EVE_GATEWAY_SECRET = "isolated-full-parity-fixture-gateway-secret";
process.env.EVE_INTERNAL_ORIGIN = "http://127.0.0.1:1";
process.env.AI_GATEWAY_API_KEY = "fixture-key";
`
    );
    await run(cwd, [
      "node",
      "--import",
      "./parity-environment.mjs",
      "node_modules/eve/bin/eve.js",
      "build",
    ]);
    expect(
      await Bun.file(path.join(cwd, ".output/server/index.mjs")).exists()
    ).toBe(true);
    // Remove the probe before comparing the complete application inventory again.
    await Bun.file(path.join(cwd, "parity-environment.mjs")).delete();
    for (const alternative of combinationCases.filter((scenario) =>
      scenario.name.startsWith("full preset with ")
    )) {
      const added = alternative.selection.tools.filter(
        (id) => !selection.tools.includes(id)
      );
      // oxlint-disable-next-line no-await-in-loop -- Each replacement is checked against a complete fresh prediction.
      await run(cwd, ["node", cliEntry, "add", ...added, "--replace", "--yes"]);
      // oxlint-disable-next-line no-await-in-loop -- Validate the installed state after each provider mutation.
      await verifyInstallationParity(cwd, alternative.selection, name);
    }
  }, 300_000);
};
