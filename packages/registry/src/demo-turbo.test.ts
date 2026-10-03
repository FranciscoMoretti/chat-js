import { afterAll, beforeAll, expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

const repoRoot = path.resolve(import.meta.dir, "../../..");
const turbo = path.join(repoRoot, "node_modules/.bin/turbo");
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
let fixture: string;
/* oxlint-enable eslint/init-declarations */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const git = (...args: string[]) => {
  const result = Bun.spawnSync(["git", ...args], { cwd: fixture });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout.toString().trim();
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const run = (...args: string[]) => {
  const result = Bun.spawnSync([turbo, "run", ...args, "--dry=json"], {
    cwd: fixture,
    env: { ...process.env, TURBO_SCM_BASE: "", TURBO_SCM_HEAD: "" },
  });
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  // oxlint-disable-next-line typescript/no-unsafe-return -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  return JSON.parse(result.stdout.toString());
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-process-env */
/* oxlint-enable node/no-sync */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
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
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const baseline = JSON.parse(
    await readFile(
      path.join(repoRoot, "packages/registry/demo-baseline.json"),
      "utf-8"
    )
  );
  await Promise.all(
    // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
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
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
afterAll(async () => {
  await rm(fixture, { force: true, recursive: true });
});

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("demo check hashes every owned copy and never restores app files; sync is uncached", async () => {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const plan = run("demo:check", "--filter=@chat-js/registry");
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const task = plan.tasks.find(
    (item: { taskId: string }) => item.taskId === "@chat-js/registry#demo:check"
  );
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const baseline = JSON.parse(
    await readFile(
      path.join(repoRoot, "packages/registry/demo-baseline.json"),
      "utf-8"
    )
  );
  expect(
    // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    Object.keys(baseline.files).filter(
      // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      (file) => !Object.hasOwn(task.inputs, `../../apps/chat/${file}`)
    )
  ).toEqual([]);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(task.dependencies).toEqual([]);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(task.resolvedTaskDefinition.cache).toBe(true);
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(task.resolvedTaskDefinition.outputs).toEqual([]);
  expect(
    // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    run("demo:sync", "--filter=@chat-js/registry").tasks[0]
      .resolvedTaskDefinition.cache
  ).toBe(false);
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const unit = run("test:unit", "--filter=@chat-js/registry").tasks.find(
    (item: { taskId: string }) => item.taskId === "@chat-js/registry#test:unit"
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(unit.dependencies).toContain("@chat-js/registry#demo:check");
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
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
    // oxlint-disable-next-line typescript/no-unsafe-member-access, typescript/no-unsafe-return -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    run("demo:check", "--filter=@chat-js/registry").tasks[0].hash;
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const before = hash();
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed input\n`);
  expect(hash() === before).toBe(!invalidates);
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
      // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
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
      // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      JSON.parse(execution.stdout.toString()).tasks.filter(
        (item: { taskId: string }) =>
          item.taskId === "@chat-js/registry#demo:check"
      )
    ).toHaveLength(1);
  }
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable node/no-process-env */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test.each([
  "packages/cli/src/utils/installation-plan.ts",
  "packages/gateways/src/definition.ts",
])("registry typecheck invalidates for imported source %s", async (file) => {
  const hash = () =>
    // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access, typescript/no-unsafe-return -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    run("test:types", "--filter=@chat-js/registry").tasks.find(
      (item: { taskId: string }) =>
        item.taskId === "@chat-js/registry#test:types"
      // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    ).hash;
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const before = hash();
  const target = path.join(fixture, file);
  await mkdir(path.dirname(target), { recursive: true });
  const previous = (await Bun.file(target).exists())
    ? await readFile(target, "utf-8")
    : "";
  await writeFile(target, `${previous}\n// changed type boundary\n`);
  expect(hash()).not.toBe(before);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
test("registry typecheck restores gateway declaration outputs on cache hits", () => {
  // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const { tasks } = run("test:types", "--filter=@chat-js/registry");
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const registry = tasks.find(
    (item: { taskId: string }) => item.taskId === "@chat-js/registry#test:types"
  );
  // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  const gateways = tasks.find(
    (item: { taskId: string }) => item.taskId === "@chat-js/gateways#test:types"
  );
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(registry.dependencies).toContain("@chat-js/gateways#test:types");
  // oxlint-disable-next-line typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
  expect(gateways.resolvedTaskDefinition.outputs).toEqual(["dist/**"]);
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
