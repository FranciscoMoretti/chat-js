import { expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { run } from "./run-command";

const selections = [
  "none",
  "projects",
  "feedback",
  "followup-suggestions",
  "search",
  "ai-titles",
] as const;
const pluginTables = [
  "Project",
  "EveChatProject",
  "EveVote",
  "EveFollowup",
  "EveSearchText",
];
const expectedTables: Record<(typeof selections)[number], readonly string[]> = {
  none: [],
  projects: ["Project", "EveChatProject"],
  feedback: ["EveVote"],
  "followup-suggestions": ["EveFollowup"],
  search: ["EveSearchText"],
  "ai-titles": [],
};

/** Reuse the packed CLI/registry fixture, keeping each app outside the workspace. */
export const testChatPluginSelections = (
  root: string,
  cliEntry: string
): void => {
  it.each([...selections])(
    "chat plugins: %s installs and compiles independently",
    async (selection) => {
      const name = `chat-plugin-${selection}`;
      const cwd = path.join(root, name);
      await run(root, [
        "node",
        cliEntry,
        "create",
        name,
        "--gateway",
        "openai",
        "--yes",
        "--no-electron",
        "--no-projects",
        "--no-mcp",
        "--no-documents",
        "--no-attachments",
      ]);
      if (selection !== "none") {
        await run(cwd, ["node", cliEntry, "add", selection, "--yes"]);
      }
      // Checking the actual tree prevents a copied reference preset from masking
      // accidental imports of an omitted plugin during compilation.
      const pluginDirectory = path.join(cwd, "plugins");
      const installedPlugins = existsSync(pluginDirectory)
        ? await readdir(pluginDirectory)
        : [];
      expect(installedPlugins.toSorted()).toEqual(
        selection === "none" ? [] : [selection]
      );
      await run(cwd, ["bun", "run", "test:types"]);

      await writeFile(
        path.join(cwd, "plugin-schema.config.ts"),
        `
import config from "./drizzle.generate.config";
export default { ...config, out: "./plugin-schema" };
`
      );
      await run(cwd, [
        "bunx",
        "--no-install",
        "drizzle-kit",
        "generate",
        "--config=plugin-schema.config.ts",
      ]);
      const schemaFiles = await readdir(path.join(cwd, "plugin-schema"));
      const migrations = schemaFiles.filter((file) => file.endsWith(".sql"));
      expect(migrations).toHaveLength(1);
      const sql = await readFile(
        path.join(cwd, "plugin-schema", migrations[0]),
        "utf-8"
      );
      expect(sql).toContain('CREATE TABLE "EveChat"');
      expect(sql).toContain('CREATE TABLE "EveConversation"');
      for (const table of pluginTables) {
        expect(sql.includes(`CREATE TABLE "${table}"`)).toBe(
          expectedTables[selection].includes(table)
        );
      }

      await writeFile(
        path.join(cwd, "plugin-environment.mjs"),
        `
process.env.AUTH_SECRET = "isolated-plugin-fixture-auth-secret";
process.env.DATABASE_URL = "postgres://fixture:fixture@127.0.0.1:1/fixture";
process.env.WORKFLOW_POSTGRES_URL = process.env.DATABASE_URL;
process.env.EVE_GATEWAY_SECRET = "isolated-plugin-fixture-gateway-secret";
process.env.EVE_INTERNAL_ORIGIN = "http://127.0.0.1:1";
process.env.OPENAI_API_KEY = "fixture-key";
`
      );
      let lifecycleMethod = "onDeleteConversations";
      if (selection === "projects") {
        lifecycleMethod = "onCreate";
      }
      if (selection === "ai-titles") {
        lifecycleMethod = "afterCreate";
      }
      await writeFile(
        path.join(cwd, "plugin-lifecycle-probe.ts"),
        `
import assert from "node:assert/strict";
import { installedChatPlugins } from "./composition/generated/installed-chat";
import { chatLinks } from "./lib/chat-plugins";
assert.equal(installedChatPlugins.length, ${selection === "none" ? 0 : 1});
assert.deepEqual(await chatLinks("fixture-owner", []), new Map());
for (const plugin of installedChatPlugins) {
  assert.equal(typeof plugin.${lifecycleMethod}, "function");
}
`
      );
      // Plain Node catches server-only/Next imports that tsc accepts. No database
      // or network is needed: the lifecycle probe only asks for empty chat links.
      await run(cwd, [
        "node",
        "--import",
        "./plugin-environment.mjs",
        "--import",
        "tsx",
        "plugin-lifecycle-probe.ts",
      ]);
      // Use the native compiler directly: the app's eve:build wrapper also runs
      // deployment database checks, which are unrelated to import isolation.
      await run(cwd, [
        "node",
        "--import",
        "./plugin-environment.mjs",
        "node_modules/eve/bin/eve.js",
        "build",
      ]);
      expect(
        await Bun.file(path.join(cwd, ".output/server/index.mjs")).exists()
      ).toBe(true);
      const compiledManifest = await readFile(
        path.join(cwd, ".output/.eve/compile/compiled-agent-manifest.json"),
        "utf-8"
      );
      for (const plugin of ["projects", "followup-suggestions", "search"]) {
        expect(compiledManifest.includes(`"hooks/${plugin}.ts"`)).toBe(
          selection === plugin
        );
      }
    },
    300_000
  );
};
