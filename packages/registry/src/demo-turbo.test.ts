import { z } from "zod";
import { afterAll, expect, test } from "bun:test";
import {
  findTask,
  jsonObject,
  jsonString,
  parseAffectedTaskNames,
  parseJsonObject,
  taskList,
} from "./test-json";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import type { TaskPlan } from "./test-json";
import path from "node:path";
import { runTestProcess } from "./plugins/test-runtime";
import { tmpdir } from "node:os";

const SUCCESS_EXIT_CODE = 0;
const EXPECTED_AFFECTED_EXIT = 1;
const EXPECTED_DEMO_CHECK_TASKS = 1;

const repoRoot = path.resolve(import.meta.dir, "../../..");
const turbo = path.join(repoRoot, "node_modules/.bin/turbo");
const copyFixtureFiles = async (directory: string): Promise<void> => {
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
    ].map((workspace) => `${workspace}/package.json`),
    "packages/registry/mirror-manifest.json",
  ];
  await Promise.all(
    files.map(async (file) => {
      await mkdir(path.dirname(path.join(directory, file)), {
        recursive: true,
      });
      await writeFile(
        path.join(directory, file),
        await readFile(path.join(repoRoot, file))
      );
    })
  );
  // Every manifest-owned copy must participate, including generated indexes.
  const manifest = parseJsonObject(
    await readFile(
      path.join(repoRoot, "packages/registry/mirror-manifest.json"),
      "utf-8"
    )
  );
  await Promise.all(
    z
      .array(z.string())
      .parse(manifest.files)
      .map(async (file) => {
        const target = path.join(directory, "apps/chat", file);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, "// fixture owned copy\n");
      })
  );
};
const gitIn = async (
  directory: string,
  ...args: readonly string[]
): Promise<string> => {
  const result = await runTestProcess(["git", ...args], { cwd: directory });
  if (result.exitCode !== SUCCESS_EXIT_CODE) {
    throw new Error(result.stderr);
  }
  return result.stdout.trim();
};
const initializeGitFixture = async (directory: string): Promise<void> => {
  await gitIn(directory, "init", "-b", "main");
  await gitIn(directory, "add", ".");
  await gitIn(
    directory,
    "-c",
    "user.name=Demo task test",
    "-c",
    "user.email=demo-test@example.invalid",
    "commit",
    "-m",
    "Baseline"
  );
};
const createFixture = async (): Promise<string> => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-demo-turbo-"));
  try {
    await copyFixtureFiles(directory);
    await initializeGitFixture(directory);
    return directory;
  } catch (error) {
    await rm(directory, { force: true, recursive: true });
    throw error;
  }
};
const fixture = await createFixture();

const git = async (...args: readonly string[]): Promise<string> => {
  const output = await gitIn(fixture, ...args);
  return output;
};
const run = async (...args: readonly string[]): Promise<TaskPlan> => {
  const result = await runTestProcess([turbo, "run", ...args, "--dry=json"], {
    cwd: fixture,
    environment: { TURBO_SCM_BASE: "", TURBO_SCM_HEAD: "" },
  });
  if (result.exitCode !== SUCCESS_EXIT_CODE) {
    throw new Error(result.stderr);
  }
  return { tasks: taskList(result.stdout) };
};
const registryTask = async (
  taskName: string
): Promise<TaskPlan["tasks"][number]> => {
  const { tasks } = await run(taskName, "--filter=@chat-js/registry");
  return findTask(tasks, `@chat-js/registry#${taskName}`);
};
const taskHash = async (taskName: string): Promise<string> => {
  const selected = await registryTask(taskName);
  return jsonString(selected.hash);
};
afterAll(async () => {
  await rm(fixture, { force: true, recursive: true });
});
test("demo check hashes every owned copy and never restores app files; sync is uncached", async () => {
  const task = await registryTask("demo:check");
  const manifest = parseJsonObject(
    await readFile(
      path.join(repoRoot, "packages/registry/mirror-manifest.json"),
      "utf-8"
    )
  );
  expect(
    z
      .array(z.string())
      .parse(manifest.files)
      .filter(
        (file) =>
          !Object.hasOwn(jsonObject(task.inputs), `../../apps/chat/${file}`)
      )
  ).toEqual([]);
  expect(task.dependencies).toEqual([]);
  expect(jsonObject(task.resolvedTaskDefinition).cache).toBe(true);
  expect(jsonObject(task.resolvedTaskDefinition).outputs).toEqual([]);
  const sync = await registryTask("demo:sync");
  expect(jsonObject(sync.resolvedTaskDefinition).cache).toBe(false);
  const unit = await registryTask("test:unit");
  expect(unit.dependencies).toContain("@chat-js/registry#demo:check");
});
test.each([
  ["packages/registry/src/tools/word-count/tool.ts", true],
  ["packages/registry/registry.ts", true],
  ["packages/registry/metadata.ts", true],
  ["packages/registry/installation.ts", true],
  ["packages/registry/mirror-manifest.json", true],
  ["packages/registry/scripts/demo-sync.ts", true],
  ["packages/cli/src/registry/shadcn.ts", true],
  ["packages/cli/src/utils/installation-plan.ts", true],
  ["packages/cli/src/helpers/gateway-provider.ts", true],
  ["packages/cli/src/helpers/storage-provider.ts", true],
  ["packages/gateways/src/definition.ts", true],
  ["patches/example.patch", true],
  ["oxfmt.config.ts", true],
  ["apps/chat/oxfmt.config.ts", true],
  ["apps/chat/components.json", true],
  ["apps/chat/tools/chatjs/word-count/tool.ts", true],
  ["apps/chat/composition/generated/tools.ts", true],
  ["apps/chat/.env.local", false],
  ["apps/chat/.next/generated.js", false],
  ["apps/chat/node_modules/example/index.js", false],
  ["apps/docs/index.mdx", false],
])("demo task hash invalidation for %s", async (file, invalidates) => {
  const before = await taskHash("demo:check");
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed input\n`);
  expect((await taskHash("demo:check")) === before).toBe(!invalidates);
});
const affectedTaskNames = async (base: string): Promise<readonly string[]> => {
  const query = await runTestProcess(
    [
      turbo,
      "query",
      "affected",
      "--tasks",
      "test:unit",
      "demo:check",
      "--base",
      base,
      "--head",
      "HEAD",
      "--exit-code",
    ],
    { cwd: fixture }
  );
  expect(query.exitCode, query.stderr).toBe(EXPECTED_AFFECTED_EXIT);
  return parseAffectedTaskNames(query.stdout);
};
const verifyAffectedExecution = async (base: string): Promise<void> => {
  const execution = await runTestProcess(
    [turbo, "run", "test:unit", "demo:check", "--affected", "--dry=json"],
    {
      cwd: fixture,
      environment: { TURBO_SCM_BASE: base, TURBO_SCM_HEAD: "HEAD" },
    }
  );
  expect(execution.exitCode, execution.stderr).toBe(SUCCESS_EXIT_CODE);
  expect(
    taskList(execution.stdout).filter(
      (item) => item.taskId === "@chat-js/registry#demo:check"
    )
  ).toHaveLength(EXPECTED_DEMO_CHECK_TASKS);
};
test.each([
  "packages/registry/src/tools/word-count/tool.ts",
  "apps/chat/tools/chatjs/word-count/tool.ts",
])(
  "CI affected query and execution select demo checking for %s",
  async (file) => {
    const base = await git("rev-parse", "HEAD");
    const target = path.join(fixture, file);
    await writeFile(target, `// CI change ${base}\n`);
    await git("add", file);
    await git(
      "-c",
      "user.name=Demo task test",
      "-c",
      "user.email=demo-test@example.invalid",
      "commit",
      "-m",
      "CI input change"
    );
    expect(await affectedTaskNames(base)).toContain(
      "@chat-js/registry#demo:check"
    );
    await verifyAffectedExecution(base);
  }
);
test.each([
  "packages/cli/src/utils/installation-plan.ts",
  "packages/gateways/src/definition.ts",
])("registry typecheck invalidates for imported source %s", async (file) => {
  const before = await taskHash("test:types");
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed type boundary\n`);
  expect(await taskHash("test:types")).not.toBe(before);
});
test("registry typecheck restores gateway declaration outputs on cache hits", async () => {
  const { tasks } = await run("test:types", "--filter=@chat-js/registry");
  const registry = findTask(tasks, "@chat-js/registry#test:types");
  const gateways = findTask(tasks, "@chat-js/gateways#test:types");
  expect(registry.dependencies).toContain("@chat-js/gateways#test:types");
  expect(jsonObject(gateways.resolvedTaskDefinition).outputs).toEqual([
    "dist/**",
  ]);
});
