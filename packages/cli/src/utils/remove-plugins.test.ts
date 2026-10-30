import { rejects } from "node:assert/strict";
import { afterEach, expect, test } from "bun:test";
import {
  cp,
  chmod,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { projectsItem } from "../../../registry/src/plugins/projects/manifest";
import { sharingItem } from "../../../registry/src/plugins/sharing/manifest";
import { mcpItem } from "../../../registry/src/plugins/mcp/manifest";
import { creditsItem } from "../../../registry/src/plugins/credits/manifest";
import { readInstalledPlugins } from "./installed-plugins";
import { recordInstalledSource } from "./source-receipt";
import { removePlugins } from "./remove-plugins";
import { syncPlugins } from "./sync-plugins";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(
    roots.splice(0).map(async (root) => {
      await rm(root, { recursive: true, force: true });
    })
  );
});
const fixture = async () => {
  const root = await mkdtemp(path.join(tmpdir(), "chatjs-remove-"));
  roots.push(root);
  await cp(
    path.resolve(import.meta.dir, "../../../../apps/chat/components.json"),
    path.join(root, "components.json")
  );
  await writeFile(
    path.join(root, "composer-controls.ts"),
    "export const composerControls = myCustomComposition();\n"
  );
  return root;
};
const installedIds = async (root: string) => {
  const plugins = await readInstalledPlugins(root);
  return plugins.map((plugin) => plugin.id);
};
const install = async (root: string, item: typeof projectsItem) => {
  const targets: string[] = [];
  for (const file of item.files ?? []) {
    if (file.target?.startsWith("~/") !== true) {
      throw new Error("Fixture requires explicit targets");
    }
    const target = file.target.slice(2);
    targets.push(target);
    // oxlint-disable-next-line no-await-in-loop -- Create a file's parent before copying its source.
    await mkdir(path.dirname(path.join(root, target)), { recursive: true });
    // oxlint-disable-next-line no-await-in-loop -- Finish each fixture file before recording installation ownership.
    await cp(
      path.resolve(import.meta.dir, "../../../registry", file.path),
      path.join(root, target)
    );
  }
  const descriptor = `plugins/${item.name}/chatjs.json`;
  await writeFile(
    path.join(root, descriptor),
    JSON.stringify(item.meta?.chatjs)
  );
  await recordInstalledSource(root, [...targets, descriptor]);
  await syncPlugins(root);
};

test("removal checks generated files it will not regenerate and ignores inactive source backups", async () => {
  const root = await fixture();
  await install(root, projectsItem);
  const source = 'export { projectsChat } from "@/plugins/projects/chat";\n';
  const generated = path.join(root, "chatjs/generated/tools.ts");
  await writeFile(generated, source);
  await rejects(
    removePlugins(root, ["projects"], { dryRun: true }),
    /generated\/tools.ts imports removed source/u
  );
  await rm(generated);
  const backup = path.join(root, "chatjs/removed-plugins/prior/source.ts");
  await mkdir(path.dirname(backup), { recursive: true });
  await writeFile(backup, source);
  const plan = await removePlugins(root, ["projects"], { dryRun: true });
  expect(plan.files).toContain("plugins/projects/chat.ts");
});

test("later installation, removal and sync preserve every app-owned integration", async () => {
  const root = await fixture();
  await mkdir(path.join(root, "integrations"));
  const integrationDirectory = path.resolve(
    import.meta.dir,
    "../../../../apps/chat/integrations"
  );
  const integrationFiles = await readdir(integrationDirectory);
  const sources = new Map(
    await Promise.all(
      integrationFiles.map(async (file) => {
        const source = `${await readFile(path.join(integrationDirectory, file), "utf-8")}\n// Application customization retained by installation.\n`;
        await writeFile(path.join(root, "integrations", file), source);
        return [file, source] as const;
      })
    )
  );
  const chatSource = `import { installedChat } from "@/chatjs/generated/installed-chat";
import { composeChat } from "@/lib/compose-chat";
export const chat = composeChat([...installedChat, { historyFilter: () => undefined }]);
`;
  const billingSource = `import { installedBilling } from "@/chatjs/generated/installed-billing";
import { composeBilling } from "@/lib/compose-billing";
const selected = composeBilling(installedBilling);
export const billing = { ...selected, canSpend: (ownerId: string) => selected.canSpend(ownerId) };
`;
  await writeFile(path.join(root, "integrations/chat.ts"), chatSource);
  await writeFile(path.join(root, "integrations/billing.ts"), billingSource);
  await install(root, projectsItem);
  await install(root, creditsItem);
  await install(root, sharingItem);
  await removePlugins(root, ["projects", "credits"]);
  await syncPlugins(root);
  expect(await readFile(path.join(root, "integrations/chat.ts"), "utf-8")).toBe(
    chatSource
  );
  expect(
    await readFile(path.join(root, "integrations/billing.ts"), "utf-8")
  ).toBe(billingSource);
  await Promise.all(
    [...sources]
      .filter(([file]) => file !== "chat.ts" && file !== "billing.ts")
      .map(async ([file, source]) => {
        expect(
          await readFile(path.join(root, "integrations", file), "utf-8")
        ).toBe(source);
      })
  );
  const chat = await readFile(
    path.join(root, "chatjs/generated/installed-chat.ts"),
    "utf-8"
  );
  expect(chat).toContain("@/plugins/sharing/chat");
  expect(chat).not.toContain("@/plugins/projects/chat");
  expect(
    await readFile(
      path.join(root, "chatjs/generated/installed-billing.ts"),
      "utf-8"
    )
  ).toContain("installedBilling: readonly UsageBilling[] = []");
  await install(root, projectsItem);
  await install(root, creditsItem);
  expect(await readFile(path.join(root, "integrations/chat.ts"), "utf-8")).toBe(
    chatSource
  );
  expect(
    await readFile(path.join(root, "integrations/billing.ts"), "utf-8")
  ).toBe(billingSource);
});

test("Projects and Sharing can be removed and reinstalled without editing app composition or dropping schema inputs", async () => {
  const root = await fixture();
  await install(root, projectsItem);
  await install(root, sharingItem);
  const userComposition = await readFile(
    path.join(root, "composer-controls.ts"),
    "utf-8"
  );
  const customized = "// customized sidebar\n";
  const file = "plugins/projects/ui/chat-contributions.tsx";
  await writeFile(path.join(root, file), customized);
  const before = await readFile(
    path.join(root, "chatjs/generated/installed-chat-ui.ts"),
    "utf-8"
  );
  const plan = await removePlugins(root, ["projects"], { dryRun: true });
  expect(plan.modified).toEqual([file]);
  expect(plan.preserved).toEqual(["plugins/projects/db/project-schema.ts"]);
  expect(
    await readFile(
      path.join(root, "chatjs/generated/installed-chat-ui.ts"),
      "utf-8"
    )
  ).toBe(before);
  await rejects(removePlugins(root, ["projects"]), /Nothing was removed/u);
  const result = await removePlugins(root, ["projects"], { backup: true });
  expect(result.backup).toBeDefined();
  expect(
    await readFile(path.join(root, `${result.backup}/${file}.bak`), "utf-8")
  ).toBe(customized);
  expect(await installedIds(root)).toEqual(["sharing"]);
  expect(
    await Bun.file(
      path.join(root, "app/(chat)/project/[projectId]/page.tsx")
    ).exists()
  ).toBe(false);
  expect(
    await Bun.file(path.join(root, "agent/hooks/projects.ts")).exists()
  ).toBe(false);
  await syncPlugins(root);
  expect(
    await readFile(
      path.join(root, "chatjs/generated/installed-database.ts"),
      "utf-8"
    )
  ).toContain("plugins/projects/db/project-schema.ts");
  expect(
    await readFile(
      path.join(root, "chatjs/generated/installed-chat-ui.ts"),
      "utf-8"
    )
  ).not.toContain("plugins/projects");
  await removePlugins(root, ["sharing"]);
  expect(await readInstalledPlugins(root)).toEqual([]);
  expect(
    await Bun.file(path.join(root, "app/(chat)/share/[id]/page.tsx")).exists()
  ).toBe(false);
  expect(await readFile(path.join(root, "composer-controls.ts"), "utf-8")).toBe(
    userComposition
  );
  await install(root, projectsItem);
  await install(root, sharingItem);
  expect(await installedIds(root)).toEqual(["projects", "sharing"]);
});

test("MCP removal retains transitive schema helpers and disconnects composer/settings registrations", async () => {
  const root = await fixture();
  await install(root, mcpItem);
  const result = await removePlugins(root, ["mcp"]);
  expect(result.preserved).toContain("plugins/mcp/db/encrypted-text.ts");
  expect(result.preserved).toContain("plugins/mcp/mcp-env.ts");
  await syncPlugins(root);
  expect(await readInstalledPlugins(root)).toEqual([]);
  for (const name of ["chat-ui", "routers"]) {
    expect(
      // oxlint-disable-next-line no-await-in-loop -- Read each independently generated integration point.
      await readFile(
        path.join(root, `chatjs/generated/installed-${name}.ts`),
        "utf-8"
      )
    ).not.toContain("plugins/mcp");
  }
});

test("required plugins and app-owned imports block removal before mutation", async () => {
  const root = await fixture();
  await install(root, projectsItem);
  await mkdir(path.join(root, "plugins/dependent"));
  await writeFile(
    path.join(root, "plugins/dependent/chatjs.json"),
    JSON.stringify({
      id: "dependent",
      kind: "plugin",
      contractVersion: 1,
      requiresPlugins: ["projects"],
    })
  );
  await rejects(
    removePlugins(root, ["projects"]),
    /requires installed plugin: projects/u
  );
  await rm(path.join(root, "plugins/dependent"), { recursive: true });
  await writeFile(
    path.join(root, "custom.ts"),
    'export { projectsClient } from "@/plugins/projects/client-plugin";'
  );
  await rejects(
    removePlugins(root, ["projects"], { backup: true }),
    /custom.ts imports removed source/u
  );
  expect(await installedIds(root)).toEqual(["projects"]);
});

test("symlinked source and unsafe ownership never reach deletion", async () => {
  const root = await fixture();
  await install(root, sharingItem);
  const target = path.join(root, "plugins/sharing/ui/chat-contributions.tsx");
  await rm(target);
  await symlink(path.join(root, "composer-controls.ts"), target);
  await rejects(
    removePlugins(root, ["sharing"], { backup: true }),
    /symlinked/u
  );
  expect(
    await readFile(path.join(root, "composer-controls.ts"), "utf-8")
  ).toContain("myCustomComposition");
});

test("registration write failure restores moved source and previous registrations", async () => {
  const root = await fixture();
  await install(root, sharingItem);
  const target = path.join(root, "chatjs/generated/installed-chat-ui.ts");
  const before = await readFile(target, "utf-8");
  await chmod(target, 0o444);
  try {
    await rejects(removePlugins(root, ["sharing"]), /Plugin removal failed/u);
    expect(await readFile(target, "utf-8")).toBe(before);
    expect(await installedIds(root)).toEqual(["sharing"]);
    expect(
      await Bun.file(path.join(root, "app/(chat)/share/[id]/page.tsx")).exists()
    ).toBe(true);
  } finally {
    await chmod(target, 0o644);
  }
});
