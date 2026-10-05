import { afterAll, beforeAll, expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture reads, writes, and validates real project files with native filesystem APIs.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The Bun test runtime provides temporary-directory and platform information for this filesystem operation.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- This Bun integration fixture resolves platform-specific project and installation paths.
import pathModule from "node:path";
/* oxlint-enable sort-imports */

const repoRoot = pathModule.resolve(import.meta.dir, "../../../..");
const turbo = pathModule.join(repoRoot, "node_modules/.bin/turbo");
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
let fixture: string;
/* oxlint-enable eslint/init-declarations */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const run = (command: string[]) =>
  Bun.spawnSync(command, {
    cwd: fixture,
    env: {
      ...process.env,
      TURBO_SCM_BASE: "",
      TURBO_SCM_HEAD: "",
    },
  });
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable node/no-process-env */
/* oxlint-enable node/no-sync */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const git = (...args: string[]): string => {
  const result = run(["git", ...args]);
  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString());
  }
  return result.stdout.toString().trim();
};
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve beforeAll's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */

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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve afterAll's awaited sequencing and rejected-Promise behavior. */
afterAll(async (): Promise<void> => {
  if (fixture) {
    await rm(fixture, { force: true, recursive: true });
  }
});
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test.each([   ["apps/docs/index.mdx", false],   ["apps/site/app/page.tsx", false],   ["README.md", f's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable node/no-process-env -- Read configuration at this server or installer boundary so callers retain the documented environment-variable behavior. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
    expect(result.exitCode, result.stderr.toString()).toBe(affected ? 1 : 0);
    // oxlint-disable-next-line typescript/no-unsafe-assignment -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const output = JSON.parse(result.stdout.toString());
    // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
    const taskNames = output.data.affectedTasks.items.map(
      (task: { fullName: string }): string => task.fullName
    );
    // oxlint-disable-next-line typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
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
    expect(execution.exitCode, execution.stderr.toString()).toBe(0);
    const plannedTasks = new Set(
      // oxlint-disable-next-line typescript/no-unsafe-argument, typescript/no-unsafe-call, typescript/no-unsafe-member-access -- Inspect the generated fixture output directly so shape or value regressions fail the runtime assertions below; parsing it into a new contract would change this test boundary.
      JSON.parse(execution.stdout.toString()).tasks.map(
        (task: { taskId: string }): string => task.taskId
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable node/no-process-env */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
