import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import pathModule from "node:path";
import { tmpdir } from "node:os";
import { z } from "zod";

const repoRoot = pathModule.resolve(import.meta.dir, "../../../..");
const turbo = pathModule.join(repoRoot, "node_modules/.bin/turbo");
const successExitCode = 0;
let fixture: string;

const run = (command: string[]) =>
  Bun.spawnSync(command, {
    cwd: fixture,
    env: {
      ...process.env,
      TURBO_SCM_BASE: "",
      TURBO_SCM_HEAD: "",
    },
  });

const git = (...args: readonly string[]): string => {
  const result = run(["git", ...args]);
  if (result.exitCode !== successExitCode) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout.toString().trim();
};

beforeAll(async (): Promise<void> => {
  fixture = await mkdtemp(pathModule.join(tmpdir(), "chatjs-turbo-affected-"));
  // Use the real task graph, workspace manifests, and lockfile without
  // installing dependencies or copying generated artifacts into the fixture.
  const files = [
    "turbo.json",
    "bun.lock",
    "package.json",
    ...[
      "apps/chat",
      "apps/docs",
      "apps/site",
      "apps/electron",
      "packages/cli",
      "packages/thread",
      "packages/registry",
      "packages/gateways",
    ].map((workspace): string => `${workspace}/package.json`),
  ];
  await Promise.all(
    files.map(async (path): Promise<void> => {
      await mkdir(pathModule.dirname(pathModule.join(fixture, path)), {
        recursive: true,
      });
      await writeFile(
        pathModule.join(fixture, path),
        await readFile(pathModule.join(repoRoot, path))
      );
    })
  );
  git("init", "-b", "main");
  git("config", "user.name", "Turbo CI test");
  git("config", "user.email", "turbo-test@example.invalid");
  git("add", ".");
  git("commit", "-m", "Fixture baseline");
});
afterAll(async (): Promise<void> => {
  if (fixture) {
    await rm(fixture, { force: true, recursive: true });
  }
});
test.each([
  ["apps/docs/index.mdx", false],
  ["apps/site/app/page.tsx", false],
  ["README.md", false],
  ["apps/chat/.next/generated.js", false],
  ["apps/chat/node_modules/example/index.js", false],
  ["apps/chat/.env.local", false],
  ["apps/electron/dist/main.js", false],
  ["apps/electron/branding.json", false],
  ["packages/cli/src/index.ts", true],
  ["packages/registry/registry.ts", true],
  ["packages/registry/metadata.ts", true],
  ["packages/registry/src/tools/word-count/tool.ts", true],
  ["packages/registry/src/gateways/vercel/gateway.ts", true],
  ["packages/cli/scripts/test-scaffold.sh", true],
  ["apps/chat/app/page.tsx", true],
  ["apps/chat/package.json", true],
  ["apps/electron/forge.config.ts", true],
  ["apps/electron/package.json", true],
  ["packages/thread/src/index.ts", false],
  ["scripts/sync-template.ts", true],
  ["scripts/sync-template-snapshot.ts", true],
  [".github/workflows/cli-scaffold.yml", true],
  ["package.json", true],
  ["bun.lock", true],
  ["turbo.json", true],
])(
  "scaffold affected detection for %s",
  async (path, affected): Promise<void> => {
    const base = git("rev-parse", "HEAD");
    const target = pathModule.join(fixture, path);
    await mkdir(pathModule.dirname(target), { recursive: true });
    const previous = await readFile(target, "utf-8").catch((): string => "");
    await writeFile(target, `${previous}\n`);
    git("add", path);
    git("commit", "-m", `Change ${path}`);

    const result = run([
      turbo,
      "query",
      "affected",
      "--tasks",
      "test:scaffold",
      "--packages",
      "@chat-js/cli",
      "--base",
      base,
      "--head",
      "HEAD",
      "--exit-code",
    ]);
    expect(result.exitCode, result.stderr.toString()).toBe(Number(affected));
    const output = z
      .object({
        data: z.object({
          affectedTasks: z.object({
            items: z.array(z.object({ fullName: z.string() })),
          }),
        }),
      })
      .parse(JSON.parse(result.stdout.toString()));
    const taskNames = output.data.affectedTasks.items.map(
      (task: { readonly fullName: string }): string => task.fullName
    );
    expect(taskNames.includes("@chat-js/cli#test:scaffold")).toBe(affected);

    // CI's execution phase must agree with the pre-install query, including
    // inputs outside the CLI package that package-level --affected would miss.
    const execution = Bun.spawnSync(
      [turbo, "run", "test:scaffold", "test:unit", "--affected", "--dry=json"],
      {
        cwd: fixture,
        env: { ...process.env, TURBO_SCM_BASE: base, TURBO_SCM_HEAD: "HEAD" },
      }
    );
    expect(execution.exitCode, execution.stderr.toString()).toBe(
      successExitCode
    );
    const planned = z
      .object({ tasks: z.array(z.object({ taskId: z.string() })) })
      .parse(JSON.parse(execution.stdout.toString()));
    const plannedTasks = new Set(
      planned.tasks.map(
        (task: { readonly taskId: string }): string => task.taskId
      )
    );
    expect(plannedTasks.has("@chat-js/cli#test:scaffold")).toBe(affected);
    if (
      path.startsWith("apps/chat/") ||
      path.startsWith("apps/site/") ||
      path.startsWith("apps/docs/") ||
      path.startsWith("apps/electron/") ||
      path.startsWith("packages/thread/src/") ||
      path.startsWith("packages/registry/src/") ||
      path === "scripts/sync-template.ts" ||
      path === "scripts/sync-template-snapshot.ts" ||
      path === "package.json"
    ) {
      expect(plannedTasks.has("@chat-js/cli#test:unit")).toBe(affected);
    }
  }
);
