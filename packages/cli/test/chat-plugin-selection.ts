import { verifyInstallationParity } from "./installation-parity";
import { generateInstallation } from "../../registry/scripts/installation-generator";
import { pluginRegistrationTargets } from "../src/utils/sync-plugins";
import { pluginDefinitionSchema } from "../../registry/metadata";
import { parsePackageJson } from "../src/helpers/package-manifest";
import { expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { run } from "./run-command";

const selections = [
  "none",
  "desktop",
  "projects",
  "feedback",
  "followup-suggestions",
  "search",
  "model-preferences",
  "ai-titles",
  "sharing",
  "credits",
  "guest-chat",
] as const;
const pluginTables = [
  "UserCredit",
  "GuestRuntimeSession",
  "GuestRuntimeRate",
  "Project",
  "EveChatProject",
  "EveVote",
  "EveFollowup",
  "EveSearchText",
  "UserModelPreference",
];
const expectedTables: Record<(typeof selections)[number], readonly string[]> = {
  none: [],
  desktop: [],
  projects: ["Project", "EveChatProject"],
  feedback: ["EveVote"],
  "followup-suggestions": ["EveFollowup"],
  search: ["EveSearchText"],
  "model-preferences": ["UserModelPreference"],
  "ai-titles": [],
  sharing: [],
  credits: ["UserCredit"],
  "guest-chat": ["GuestRuntimeSession", "GuestRuntimeRate"],
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
      expect(existsSync(path.join(cwd, "app/(chat)/share/[id]/page.tsx"))).toBe(
        selection === "sharing"
      );
      expect(existsSync(path.join(cwd, "app/api/eve-guest/route.ts"))).toBe(
        selection === "guest-chat"
      );
      expect(
        existsSync(path.join(cwd, "app/(auth)/device-login/page.tsx"))
      ).toBe(selection === "desktop");
      expect(existsSync(path.join(cwd, "electron/package.json"))).toBe(
        selection === "desktop"
      );
      const installedPackage = parsePackageJson(
        await readFile(path.join(cwd, "package.json"), "utf-8")
      );
      expect(
        "@better-auth/electron" in (installedPackage.dependencies ?? {})
      ).toBe(selection === "desktop");
      const pluginDirectory = path.join(cwd, "chatjs/plugins");
      const installedPlugins = existsSync(pluginDirectory)
        ? await readdir(pluginDirectory)
        : [];
      expect(installedPlugins.toSorted()).toEqual(
        selection === "none" ? [] : [selection]
      );
      const predicted = await generateInstallation({
        gateway: "openai",
        storage: { source: "memory", options: {} },
        tools: [],
        plugins: selection === "none" ? [] : [selection],
      });
      // Compare the shared renderer with independently packaged registry installation.
      // Targets come from manifests and the real registration generator, not a test inventory.
      const targets = new Set([
        ...pluginRegistrationTargets,
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
      if (selection === "desktop") {
        const companion = path.join(cwd, "electron");
        await run(companion, ["bun", "install"]);
        await run(companion, ["bun", "run", "build"]);
        expect(existsSync(path.join(companion, "dist/main.js"))).toBe(true);
        const configuration = await readFile(
          path.join(companion, "src/config.ts"),
          "utf-8"
        );
        expect(configuration).toContain("../branding.json");
        expect(configuration).not.toContain("@/");
        expect(configuration).not.toContain("../lib/config");
        await writeFile(
          path.join(companion, "custom.txt"),
          "preserve companion changes"
        );
        await run(cwd, ["node", cliEntry, "add", "desktop", "--yes"]);
        expect(
          await readFile(path.join(companion, "custom.txt"), "utf-8")
        ).toBe("preserve companion changes");
        const createdName = "chat-created-desktop";
        await run(root, [
          "node",
          cliEntry,
          "create",
          createdName,
          "--gateway",
          "openai",
          "--yes",
          "--electron",
          "--no-projects",
          "--no-mcp",
          "--no-documents",
          "--no-attachments",
        ]);
        const created = path.join(root, createdName);
        expect(existsSync(path.join(created, "electron/package.json"))).toBe(
          true
        );
        expect(
          existsSync(path.join(created, "chatjs/plugins/desktop/chatjs.json"))
        ).toBe(true);
        expect(
          await readFile(
            path.join(created, "chatjs/generated/installed-auth.ts"),
            "utf-8"
          )
        ).toContain("@/chatjs/plugins/desktop/auth-server");
      }

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
import { installedChat } from "./chatjs/generated/installed-chat";
import { chat } from "./integrations/chat/server";
import { installedSessionProfiles } from "./chatjs/generated/installed-session-profiles";
import { installedCleanupTasks } from "./chatjs/generated/installed-cleanup";
import { requireSessionProfile } from "./lib/eve/session-profile";
import { requireAccountSession } from "./lib/eve/session-identity";
assert.equal(installedSessionProfiles.length, ${selection === "guest-chat" ? 1 : 0});
assert.equal(installedCleanupTasks.length, ${selection === "guest-chat" ? 1 : 0});
assert.throws(() => requireSessionProfile({ auth: { initiator: { authenticator: "missing" } } }));
assert.throws(() => requireAccountSession({ auth: { initiator: { authenticator: "chatjs-disposable-guest" } } }));
for (const profile of installedSessionProfiles) {
  assert.equal(await profile.authenticate(new Request("http://localhost/eve/v1/session")), null);
}
import { billing } from "./integrations/billing";
assert.equal(billing.debit !== undefined, ${selection === "credits"});
${selection === "none" ? 'assert.equal(await billing.canSpend("fixture-owner"), true);' : ""}
assert.equal(installedChat.length, ${["none", "desktop", "credits", "model-preferences", "guest-chat"].includes(selection) ? 0 : 1});
assert.deepEqual(await chat.links("fixture-owner", []), new Map());
for (const plugin of installedChat) {
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
