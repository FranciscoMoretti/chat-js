import { afterAll, expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- Create, snapshot, and remove a real temporary Git repository; Bun.file alone does not allocate temporary directories or create/remove directory trees. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- Use the host OS temporary directory for disposable fixtures; a hardcoded /tmp path or direct TMPDIR read is not portable. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- Resolve repository, staging, and temporary paths with host path semantics; URL/string concatenation does not preserve arbitrary Windows filesystem paths. */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import path from "node:path";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-nodejs-modules */

import { runTestProcess } from "./features/test-runtime";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  findTask,
  jsonObject,
  jsonString,
  parseAffectedTaskNames,
  parseJsonObject,
  taskList,
} from "./test-json";
/* oxlint-enable sort-imports */
import type { TaskPlan } from "./test-json";

const SUCCESS_EXIT_CODE = 0;
const EXPECTED_AFFECTED_EXIT = 1;
const EXPECTED_DEMO_CHECK_TASKS = 1;

const repoRoot = path.resolve(import.meta.dir, "../../..");
const turbo = path.join(repoRoot, "node_modules/.bin/turbo");
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve copyFixtureFiles's awaited sequencing and rejected-Promise behavior. */
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
    "packages/registry/demo-baseline.json",
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
  // Every baseline-owned copy must participate, including generated indexes.
  const baseline = parseJsonObject(
    await readFile(
      path.join(repoRoot, "packages/registry/demo-baseline.json"),
      "utf-8"
    )
  );
  await Promise.all(
    Object.keys(jsonObject(baseline.files)).map(async (file) => {
      const target = path.join(directory, "apps/chat", file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "// fixture owned copy\n");
    })
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve gitIn's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve initializeGitFixture's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve createFixture's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
// oxlint-disable-next-line node/no-top-level-await -- This Bun suite prepares its shared temporary Git fixture before registering command scenarios.
const fixture = await createFixture();

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve git's awaited sequencing and rejected-Promise behavior. */
const git = async (...args: readonly string[]): Promise<string> => {
  const output = await gitIn(fixture, ...args);
  return output;
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve run's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve registryTask's awaited sequencing and rejected-Promise behavior. */
const registryTask = async (
  taskName: string
): Promise<TaskPlan["tasks"][number]> => {
  const { tasks } = await run(taskName, "--filter=@chat-js/registry");
  return findTask(tasks, `@chat-js/registry#${taskName}`);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve taskHash's awaited sequencing and rejected-Promise behavior. */
const taskHash = async (taskName: string): Promise<string> => {
  const selected = await registryTask(taskName);
  return jsonString(selected.hash);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
afterAll(async () => {
  await rm(fixture, { force: true, recursive: true });
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("demo check hashes every owned copy and never restores app files; sync is uncached", async () => {
  const task = await registryTask("demo:check");
  const baseline = parseJsonObject(
    await readFile(
      path.join(repoRoot, "packages/registry/demo-baseline.json"),
      "utf-8"
    )
  );
  expect(
    Object.keys(jsonObject(baseline.files)).filter(
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   ["packages/registry/src/tools/word-count/tool.ts", true],   ["packages/registry/regist's awaited sequencing and rejected-Promise behavior. */
test.each([
  ["packages/registry/src/tools/word-count/tool.ts", true],
  ["packages/registry/registry.ts", true],
  ["packages/registry/metadata.ts", true],
  ["packages/registry/installation.ts", true],
  ["packages/registry/demo-baseline.json", true],
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
  ["apps/chat/tools/chatjs/tools.ts", true],
  ["apps/chat/.env.local", false],
  ["apps/chat/.next/generated.js", false],
  ["apps/chat/node_modules/example/index.js", false],
  ["apps/docs/index.mdx", false],
])("demo task hash invalidation for %s", async (file, invalidates) => {
  const before = await taskHash("demo:check");
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  // oxlint-disable-next-line no-ternary -- Keep previous as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed input\n`);
  expect((await taskHash("demo:check")) === before).toBe(!invalidates);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve affectedTaskNames's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve verifyAffectedExecution's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   "packages/registry/src/tools/word-count/tool.ts",   "apps/chat/tools/chatjs/word-count's awaited sequencing and rejected-Promise behavior. */
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   "packages/cli/src/utils/installation-plan.ts",   "packages/gateways/src/definition.ts"'s awaited sequencing and rejected-Promise behavior. */
test.each([
  "packages/cli/src/utils/installation-plan.ts",
  "packages/gateways/src/definition.ts",
])("registry typecheck invalidates for imported source %s", async (file) => {
  const before = await taskHash("test:types");
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  // oxlint-disable-next-line no-ternary -- Keep previous as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed type boundary\n`);
  expect(await taskHash("test:types")).not.toBe(before);
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test("registry typecheck restores gateway declaration outputs on cache hits", async () => {
  const { tasks } = await run("test:types", "--filter=@chat-js/registry");
  const registry = findTask(tasks, "@chat-js/registry#test:types");
  const gateways = findTask(tasks, "@chat-js/gateways#test:types");
  expect(registry.dependencies).toContain("@chat-js/gateways#test:types");
  expect(jsonObject(gateways.resolvedTaskDefinition).outputs).toEqual([
    "dist/**",
  ]);
});
/* oxlint-enable oxc/no-async-await */
