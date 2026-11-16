import { expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  eveInstallArguments,
  installEveIntegrations,
  validateEveSources,
} from "./eve-integrations";

test("native installation delegates without granting consent or overwriting app files", () => {
  expect(eveInstallArguments("connection/linear")).toEqual([
    "eve",
    "add",
    "connection/linear",
    "--skip-setup",
    "--non-interactive",
  ]);
  for (const id of [
    "@skills/vercel-labs/agent-skills/vercel-react-best-practices",
    "@chatjs/deep-research",
    "@acme/tool",
    "https://registry.example/item.json?q=a&limit=1",
  ]) {
    expect(eveInstallArguments(id)).toEqual([
      "eve",
      "add",
      id,
      "--skip-setup",
      "--non-interactive",
    ]);
  }
  expect(() => eveInstallArguments("channel/web")).toThrow(
    "manual composition"
  );
  expect(() => eveInstallArguments("--overwrite")).toThrow();
});

test("recipe replay restores captured EVE sources without invoking an installer or network", async () => {
  const cwd = await mkdtemp(path.join(tmpdir(), "chatjs-eve-recipe-"));
  const content = "export default { native: true };\n";
  const sources = [
    {
      path: "agent/connections/linear.ts",
      content,
      sha256: createHash("sha256").update(content).digest("hex"),
    },
  ];
  try {
    await installEveIntegrations(cwd, ["connection/linear"], "bun", sources);
    expect(await readFile(path.join(cwd, sources[0].path), "utf-8")).toBe(
      content
    );
    expect(
      await readFile(path.join(cwd, "chatjs/eve-setup.md"), "utf-8")
    ).toContain("eve add connection/linear --skip-install");
    expect(() =>
      validateEveSources([{ ...sources[0], content: "changed" }])
    ).toThrow("changed");
    for (const file of [
      "agent/../../outside",
      ".env.local",
      "agent/.env",
      "package.json",
    ]) {
      expect(() => validateEveSources([{ ...sources[0], path: file }])).toThrow(
        "Invalid EVE source path"
      );
    }
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
