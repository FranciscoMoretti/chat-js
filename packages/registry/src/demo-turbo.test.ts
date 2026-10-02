import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dir, "../../..");
const turbo = path.join(repoRoot, "node_modules/.bin/turbo");
let fixture: string;
const git = (...args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], { cwd: fixture });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout.toString().trim();
};

const run = (...args: string[]) => {
  const result = Bun.spawnSync([turbo, "run", ...args, "--dry=json"], {
    cwd: fixture,
    env: { ...process.env, TURBO_SCM_BASE: "", TURBO_SCM_HEAD: "" },
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return JSON.parse(result.stdout.toString());
};

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
  const baseline = JSON.parse(
    await readFile(
      path.join(repoRoot, "packages/registry/demo-baseline.json"),
      "utf-8"
    )
  );
  await Promise.all(
    Object.keys(baseline.files).map(async (file) => {
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
afterAll(async () => {
  await rm(fixture, { force: true, recursive: true });
});

test("demo check hashes every owned copy and never restores app files; sync is uncached", async () => {
  const plan = run("demo:check", "--filter=@chat-js/registry");
  const task = plan.tasks.find(
    (item: { taskId: string }) => item.taskId === "@chat-js/registry#demo:check"
  );
  const baseline = JSON.parse(
    await readFile(
      path.join(repoRoot, "packages/registry/demo-baseline.json"),
      "utf-8"
    )
  );
  expect(
    Object.keys(baseline.files).filter(
      (file) => !Object.hasOwn(task.inputs, `../../apps/chat/${file}`)
    )
  ).toEqual([]);
  expect(task.dependencies).toEqual([]);
  expect(task.resolvedTaskDefinition.cache).toBe(true);
  expect(task.resolvedTaskDefinition.outputs).toEqual([]);
  expect(
    run("demo:sync", "--filter=@chat-js/registry").tasks[0]
      .resolvedTaskDefinition.cache
  ).toBe(false);
  const unit = run("test:unit", "--filter=@chat-js/registry").tasks.find(
    (item: { taskId: string }) => item.taskId === "@chat-js/registry#test:unit"
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
  const hash = () =>
    run("demo:check", "--filter=@chat-js/registry").tasks[0].hash;
  const before = hash();
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed input\n`);
  expect(hash() === before).toBe(!invalidates);
});

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
    expect(
      JSON.parse(query.stdout.toString()).data.affectedTasks.items.map(
        (item: { fullName: string }) => item.fullName
      )
    ).toContain("@chat-js/registry#demo:check");
    const execution = Bun.spawnSync(
      [turbo, "run", "test:unit", "demo:check", "--affected", "--dry=json"],
      {
        cwd: fixture,
        env: { ...process.env, TURBO_SCM_BASE: base, TURBO_SCM_HEAD: "HEAD" },
      }
    );
    expect(execution.exitCode, execution.stderr.toString()).toBe(0);
    expect(
      JSON.parse(execution.stdout.toString()).tasks.filter(
        (item: { taskId: string }) =>
          item.taskId === "@chat-js/registry#demo:check"
      )
    ).toHaveLength(1);
  }
});
