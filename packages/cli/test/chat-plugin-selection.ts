import { verifyInstallationParity } from "./installation-parity";
import { generateInstallation } from "../../registry/scripts/installation-generator";
import { pluginRegistrationTargets } from "../src/utils/sync-plugins";
import { pluginDefinitionSchema } from "../../registry/metadata";
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
  "model-preferences",
  "ai-titles",
  "sharing",
  "credits",
] as const;
const pluginTables = [
  "UserCredit",
  "Project",
  "EveChatProject",
  "EveVote",
  "EveFollowup",
  "EveSearchText",
  "UserModelPreference",
];
const expectedTables: Record<(typeof selections)[number], readonly string[]> = {
  none: [],
  projects: ["Project", "EveChatProject"],
  feedback: ["EveVote"],
  "followup-suggestions": ["EveFollowup"],
  search: ["EveSearchText"],
  "model-preferences": ["UserModelPreference"],
  "ai-titles": [],
  sharing: [],
  credits: ["UserCredit"],
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
      const pluginUi = {
        "composer-controls.ts": await readFile(
          path.join(cwd, "composer-controls.ts"),
          "utf-8"
        ),
        "settings-items.ts": await readFile(
          path.join(cwd, "settings-items.ts"),
          "utf-8"
        ),
      };
      if (selection !== "none") {
        await run(cwd, ["node", cliEntry, "add", selection, "--yes"]);
      }
      // Checking the actual tree prevents a copied reference preset from masking
      // accidental imports of an omitted plugin during compilation.
      expect(existsSync(path.join(cwd, "app/(chat)/share/[id]/page.tsx"))).toBe(
        selection === "sharing"
      );
      const pluginDirectory = path.join(cwd, "plugins");
      const installedPlugins = existsSync(pluginDirectory)
        ? await readdir(pluginDirectory)
        : [];
      expect(installedPlugins.toSorted()).toEqual(
        selection === "none" ? [] : [selection]
      );
      const predicted = await generateInstallation(
        {
          gateway: "openai",
          storage: { source: "memory", options: {} },
          tools: [],
          plugins: selection === "none" ? [] : [selection],
        },
        { pluginUi }
      );
      // Compare the shared renderer with independently packaged registry installation.
      // Targets come from manifests and the real registration generator, not a test inventory.
      const targets = new Set([
        ...pluginRegistrationTargets,
        ...Object.keys(pluginUi),
        ...predicted.items
          .filter(
            (item) =>
              pluginDefinitionSchema.safeParse(item.meta?.chatjs).success
          )
          .flatMap((item) =>
            (item.files ?? []).map((file) => file.target?.slice(2) ?? "")
          ),
      ]);
      for (const file of targets) {
        const expected = predicted.files.get(file);
        if (expected === undefined) {
          throw new Error(`Missing predicted output: ${file}`);
        }
        // oxlint-disable-next-line no-await-in-loop -- Report byte parity at the exact declared installation target.
        expect(await readFile(path.join(cwd, file), "utf-8")).toBe(expected);
      }
      await verifyInstallationParity(
        cwd,
        {
          gateway: "openai",
          storage: { source: "memory", options: {} },
          tools: [],
          plugins: selection === "none" ? [] : [selection],
        },
        name
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
      if (selection === "sharing") {
        lifecycleMethod = "publicReadFilter";
      }
      await writeFile(
        path.join(cwd, "plugin-lifecycle-probe.ts"),
        `
import assert from "node:assert/strict";
import { installedChatPlugins } from "./composition/generated/installed-chat";
import { chatLinks } from "./lib/chat-plugins";
import { usageBilling, canSpend } from "./composition/generated/installed-billing";
assert.equal(usageBilling !== undefined, ${selection === "credits"});
${selection === "none" ? 'assert.equal(await canSpend("fixture-owner"), true);' : ""}
assert.equal(installedChatPlugins.length, ${selection === "none" || selection === "credits" || selection === "model-preferences" ? 0 : 1});
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
