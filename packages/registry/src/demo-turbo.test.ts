import { afterAll, beforeAll, expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This Bun integration test creates and removes real temporary files and Git fixture directories using the Node filesystem/path APIs. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This Bun integration test creates and removes real temporary files and Git fixture directories using the Node filesystem/path APIs. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This Bun integration test creates and removes real temporary files and Git fixture directories using the Node filesystem/path APIs. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

import {
  jsonArray,
  jsonObject,
  jsonString,
  parseJsonObject,
} from "./test-json";

const taskList = (
  source: string
): readonly Readonly<Record<string, unknown>>[] =>
  jsonArray(parseJsonObject(source).tasks).map((item) => jsonObject(item));

const findTask = (
  tasks: readonly Readonly<Record<string, unknown>>[],
  taskId: string
): Readonly<Record<string, unknown>> => {
  const task = tasks.find((item) => item.taskId === taskId);
  if (!task) {
    throw new Error(`Missing Turbo task: ${taskId}`);
  }
  return task;
};

const taskDefinition = (
  tasks: readonly Readonly<Record<string, unknown>>[],
  taskId: string
): Readonly<Record<string, unknown>> =>
  jsonObject(findTask(tasks, taskId).resolvedTaskDefinition);

const repoRoot = path.resolve(import.meta.dir, "../../..");
const turbo = path.join(repoRoot, "node_modules/.bin/turbo");
/* oxlint-disable eslint/init-declarations -- beforeAll assigns the temporary repository path before any subprocess test runs; an initial working-directory fallback would target the wrong repository. */
let fixture: string;
/* oxlint-enable eslint/init-declarations */
/* oxlint-disable node/no-sync -- Each Turbo/git subprocess must finish before this shared fixture advances to its next commit, hash, or affected-task assertion. */
/* oxlint-disable eslint/no-magic-numbers -- Compare documented Git/Turbo exit statuses directly in this fixture; numeric assertions are the observable CLI contract. */
const git = (...args: readonly string[]): string => {
  const result = Bun.spawnSync(["git", ...args], { cwd: fixture });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout.toString().trim();
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */

/* oxlint-disable node/no-sync -- Each Turbo/git subprocess must finish before this shared fixture advances to its next commit, hash, or affected-task assertion. */
/* oxlint-disable node/no-process-env -- Pass the inherited environment while explicitly controlling Turbo SCM base/head for this temporary Git fixture. */
/* oxlint-disable eslint/no-magic-numbers -- Compare documented Git/Turbo exit statuses directly in this fixture; numeric assertions are the observable CLI contract. */
const run = (
  ...args: readonly string[]
): {
  readonly tasks: readonly Readonly<Record<string, unknown>>[];
} => {
  const result = Bun.spawnSync([turbo, "run", ...args, "--dry=json"], {
    cwd: fixture,
    env: { ...process.env, TURBO_SCM_BASE: "", TURBO_SCM_HEAD: "" },
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return { tasks: taskList(result.stdout.toString()) };
};
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-process-env */
/* oxlint-enable node/no-sync */

/* oxlint-disable eslint/max-statements -- Keep setup, side effects, and assertions for the full temporary Git fixture setup together so the transaction and cleanup remain visible in one test. */
/* oxlint-disable eslint/max-lines-per-function -- Keep setup, side effects, and assertions for the full temporary Git fixture setup together so the transaction and cleanup remain visible in one test. */
/* oxlint-disable node/no-sync -- Each Turbo/git subprocess must finish before this shared fixture advances to its next commit, hash, or affected-task assertion. */
/* oxlint-disable eslint/no-magic-numbers -- Compare documented Git/Turbo exit statuses directly in this fixture; numeric assertions are the observable CLI contract. */
beforeAll(async () => {
  fixture = await mkdtemp(path.join(tmpdir(), "chatjs-demo-turbo-"));
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
      await mkdir(path.dirname(path.join(fixture, file)), { recursive: true });
      await writeFile(
        path.join(fixture, file),
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
      const target = path.join(fixture, "apps/chat", file);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, "// fixture owned copy\n");
    })
  );
  for (const args of [
    ["init", "-b", "main"],
    ["add", "."],
  ]) {
    const result = Bun.spawnSync(["git", ...args], { cwd: fixture });
    if (result.exitCode !== 0) {
      throw new Error(result.stderr.toString());
    }
  }
  const committed = Bun.spawnSync(
    [
      "git",
      "-c",
      "user.name=Demo task test",
      "-c",
      "user.email=demo-test@example.invalid",
      "commit",
      "-m",
      "Baseline",
    ],
    { cwd: fixture }
  );
  if (committed.exitCode !== 0) {
    throw new Error(committed.stderr.toString());
  }
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
afterAll(async () => {
  await rm(fixture, { force: true, recursive: true });
});

test("demo check hashes every owned copy and never restores app files; sync is uncached", async () => {
  const plan = run("demo:check", "--filter=@chat-js/registry");
  const task = findTask(plan.tasks, "@chat-js/registry#demo:check");
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
  expect(
    taskDefinition(
      run("demo:sync", "--filter=@chat-js/registry").tasks,
      "@chat-js/registry#demo:sync"
    ).cache
  ).toBe(false);
  const unit = findTask(
    run("test:unit", "--filter=@chat-js/registry").tasks,
    "@chat-js/registry#test:unit"
  );
  expect(unit.dependencies).toContain("@chat-js/registry#demo:check");
});

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
  const hash = (): string =>
    jsonString(
      findTask(
        run("demo:check", "--filter=@chat-js/registry").tasks,
        "@chat-js/registry#demo:check"
      ).hash
    );
  const before = hash();
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed input\n`);
  expect(hash() === before).toBe(!invalidates);
});

/* oxlint-disable eslint/max-statements -- Keep setup, side effects, and assertions for CI affected query and execution select demo checking for canonical and demo edits together so the transaction and cleanup remain visible in one test. */
/* oxlint-disable eslint/max-lines-per-function -- Keep setup, side effects, and assertions for CI affected query and execution select demo checking for canonical and demo edits together so the transaction and cleanup remain visible in one test. */
/* oxlint-disable node/no-sync -- Each Turbo/git subprocess must finish before this shared fixture advances to its next commit, hash, or affected-task assertion. */
/* oxlint-disable eslint/no-magic-numbers -- Compare documented Git/Turbo exit statuses directly in this fixture; numeric assertions are the observable CLI contract. */
/* oxlint-disable node/no-process-env -- Pass the inherited environment while explicitly controlling Turbo SCM base/head for this temporary Git fixture. */
test("CI affected query and execution select demo checking for canonical and demo edits", async () => {
  for (const file of [
    "packages/registry/src/tools/word-count/tool.ts",
    "apps/chat/tools/chatjs/word-count/tool.ts",
  ]) {
    const base = git("rev-parse", "HEAD");
    const target = path.join(fixture, file);
    // oxlint-disable-next-line eslint/no-await-in-loop -- Each commit defines a separate CI change boundary.
    await writeFile(target, `// CI change ${base}\n`);
    git("add", file);
    git(
      "-c",
      "user.name=Demo task test",
      "-c",
      "user.email=demo-test@example.invalid",
      "commit",
      "-m",
      "CI input change"
    );
    const query = Bun.spawnSync(
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
    expect(query.exitCode, query.stderr.toString()).toBe(1);
    const data = jsonObject(parseJsonObject(query.stdout.toString()).data);
    const affectedTasks = jsonObject(data.affectedTasks);
    const affectedNames = jsonArray(affectedTasks.items).map(
      (item) => jsonObject(item).fullName
    );
    expect(affectedNames).toContain("@chat-js/registry#demo:check");
    const execution = Bun.spawnSync(
      [turbo, "run", "test:unit", "demo:check", "--affected", "--dry=json"],
      {
        cwd: fixture,
        env: { ...process.env, TURBO_SCM_BASE: base, TURBO_SCM_HEAD: "HEAD" },
      }
    );
    expect(execution.exitCode, execution.stderr.toString()).toBe(0);
    expect(
      taskList(execution.stdout.toString()).filter(
        (item) => item.taskId === "@chat-js/registry#demo:check"
      )
    ).toHaveLength(1);
  }
});
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

test.each([
  "packages/cli/src/utils/installation-plan.ts",
  "packages/gateways/src/definition.ts",
])("registry typecheck invalidates for imported source %s", async (file) => {
  const hash = (): string =>
    jsonString(
      findTask(
        run("test:types", "--filter=@chat-js/registry").tasks,
        "@chat-js/registry#test:types"
      ).hash
    );
  const before = hash();
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed type boundary\n`);
  expect(hash()).not.toBe(before);
});

test("registry typecheck restores gateway declaration outputs on cache hits", () => {
  const { tasks } = run("test:types", "--filter=@chat-js/registry");
  const registry = findTask(tasks, "@chat-js/registry#test:types");
  const gateways = findTask(tasks, "@chat-js/gateways#test:types");
  expect(registry.dependencies).toContain("@chat-js/gateways#test:types");
  expect(jsonObject(gateways.resolvedTaskDefinition).outputs).toEqual([
    "dist/**",
  ]);
});
