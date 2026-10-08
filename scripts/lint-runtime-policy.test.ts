import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- These Bun lint probes create isolated project directories and resolve their source paths.
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- These Bun lint probes create isolated project directories and resolve their source paths.
import path from "node:path";
// oxlint-disable-next-line import/no-nodejs-modules -- These Bun lint probes create isolated project directories and resolve their source paths.
import { tmpdir } from "node:os";

const root = path.resolve(import.meta.dir, "..");
const runtimePaths = [
  "packages/cli/src/probe.ts",
  "packages/cli/src/annotated-probe.ts",
  "packages/cli/test/probe.ts",
  "packages/cli/scripts/probe.ts",
  "scripts/probe.ts",
  "apps/electron/src/main.ts",
  "apps/electron/src/annotated-probe.ts",
  "apps/electron/scripts/probe.ts",
  "apps/electron/forge.config.ts",
];
const protectedPaths = [
  "apps/electron/src/preload.ts",
  "apps/electron/src/renderer.ts",
  "packages/cli/templates/probe.ts",
  "apps/chat/components/probe.ts",
  "packages/registry/src/probe.ts",
];

const standaloneRuntimePaths = [
  "electron/src/main.ts",
  "electron/src/annotated-probe.ts",
  "electron/scripts/probe.ts",
  "electron/forge.config.ts",
];
const standaloneProtected = [
  "electron/src/preload.ts",
  "electron/src/renderer.ts",
  "components/probe.ts",
];

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeFixture's awaited sequencing and rejected-Promise behavior. */
const writeFixture = async (temporary: string, file: string): Promise<void> => {
  const destination = path.join(temporary, file);
  await mkdir(path.dirname(destination), { recursive: true });
  // oxlint-disable-next-line no-ternary -- Keep annotation as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const annotation = file.endsWith("annotated-probe.ts")
    ? "// oxlint-disable-next-line import/no-nodejs-modules -- This runtime fixture explicitly needs the host filesystem.\n"
    : "";
  await writeFile(
    destination,
    `${annotation}import fs from "node:fs";\nexport const exists = fs.existsSync;\n`
  );
};
/* oxlint-enable oxc/no-async-await */

const childDeadlineMs = 10_000;
const testDeadlineMs = 30_000;
const diagnosticFailureExit = 1;
const diagnosticLocation = /^(?<filename>.+?):\d+:\d+:/u;

/* oxlint-disable oxc/no-async-await -- Drain native tool pipes and exit before checking the isolated fixture. */
const runNative = async (
  cwd: string,
  args: readonly string[]
): Promise<{ output: string; exitCode: number }> => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--bun",
      path.join(root, "node_modules/oxlint/bin/oxlint"),
      ...args,
    ],
    { cwd, stderr: "pipe", stdout: "pipe" }
  );
  const deadline = setTimeout(
    (): void => child.kill("SIGKILL"),
    childDeadlineMs
  );
  try {
    const [output, errors, exitCode] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    expect(errors).toBe("");
    return { exitCode, output };
  } finally {
    clearTimeout(deadline);
    child.kill("SIGKILL");
    await child.exited;
  }
};
/* oxlint-enable oxc/no-async-await */

const assertDiagnostics = (
  output: string,
  cwd: string,
  files: readonly string[]
): void => {
  for (const file of files) {
    const diagnostics = output.split("\n").filter((line): boolean => {
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading filename from diagnosticLocation.exec(...).groups; read groups from diagnosticLocation.exec(...); preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
      const filename = diagnosticLocation.exec(line)?.groups?.filename;
      return (
        filename === path.relative(cwd, file) ||
        // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading endsWith from filename; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
        filename?.endsWith(`/${file}`) === true
      );
    });
    expect(
      diagnostics.some((line): boolean =>
        line.includes("[Error/import(no-nodejs-modules)]")
      ),
      `${cwd}: ${file}`
    ).toBe(!file.endsWith("annotated-probe.ts"));
    expect(
      diagnostics.some((line): boolean =>
        line.includes("[Warning/import(no-nodejs-modules)]")
      ),
      `${cwd}: ${file}`
    ).toBe(false);
  }
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve checkBoundary's awaited sequencing and rejected-Promise behavior. */
const checkBoundary = async (
  temporary: string,
  cwd: string,
  files: readonly string[]
): Promise<void> => {
  const { output, exitCode } = await runNative(path.join(temporary, cwd), [
    "-c",
    path.join(temporary, "oxlint.config.ts"),
    ...files.map((file): string => path.join(temporary, file)),
    "--format",
    "unix",
  ]);
  expect(exitCode, cwd).toBe(diagnosticFailureExit);
  assertDiagnostics(output, cwd, files);
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve settleChecks's awaited sequencing and rejected-Promise behavior. */
const settleChecks = async (
  checks: readonly (() => Promise<void>)[]
): Promise<void> => {
  const results = await Promise.allSettled(
    checks.map(async (check): Promise<void> => await check())
  );
  for (const result of results) {
    if (result.status === "rejected") {
      throw result.reason;
    }
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve writeConfig's awaited sequencing and rejected-Promise behavior. */
const writeConfig = async (
  temporary: string,
  source: string
): Promise<void> => {
  await writeFile(
    path.join(temporary, "oxlint.config.ts"),
    `import config from ${JSON.stringify(path.join(root, source))};\nexport default { ...config, options: { typeAware: false } };\n`
  );
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
test(
  "Node imports require source exceptions in every runtime and working directory",
  async (): Promise<void> => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "chatjs-lint-runtime-")
    );
    try {
      await writeConfig(temporary, "oxlint.config.ts");
      const files = [...runtimePaths, ...protectedPaths];
      await settleChecks(
        [...files, ...standaloneRuntimePaths, ...standaloneProtected].map(
          (file): (() => Promise<void>) =>
            async (): Promise<void> =>
              await writeFixture(temporary, file)
        )
      );
      await settleChecks(
        [".", "packages/cli", "apps/electron"].map(
          (cwd): (() => Promise<void>) =>
            async (): Promise<void> =>
              await checkBoundary(
                temporary,
                cwd,
                files.filter(
                  (file): boolean => cwd === "." || file.startsWith(`${cwd}/`)
                )
              )
        )
      );
      await writeConfig(temporary, "apps/chat/oxlint.config.ts");
      await settleChecks(
        [".", "electron"].map(
          (cwd): (() => Promise<void>) =>
            async (): Promise<void> =>
              await checkBoundary(
                temporary,
                cwd,
                [...standaloneRuntimePaths, ...standaloneProtected].filter(
                  (file): boolean => cwd === "." || file.startsWith(`${cwd}/`)
                )
              )
        )
      );
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);
/* oxlint-enable oxc/no-async-await */

const ternaryPolicyFixtures = {
  "annotated-value.ts":
    'export const pick = (flag: boolean): string => {\n// oxlint-disable-next-line no-ternary -- Preserve this lazy value selection; pinned unicorn/prefer-ternary rejects if/else assignment.\nconst selected = flag ? "yes" : "no";\nreturn selected;\n};\n',
  "guard-return.ts":
    'export const pick = (flag: boolean): string => { if (flag) { return "yes"; } return "no"; };\n',
  "nested-callback.ts":
    'export const pick = (outerFlag: boolean, innerFlag: boolean): (() => string) => {\nconst fallback = (): string => "fallback";\nconst selected = /* oxlint-disable no-ternary -- Preserve this lazy callback selection; pinned unicorn/prefer-ternary rejects if/else assignment. */ outerFlag /* oxlint-enable no-ternary */ ? (): string => { return innerFlag ? "left" : "right"; } : fallback;\nreturn selected;\n};\n',
  "plain-ternary.ts":
    'export const pick = (flag: boolean): string => flag ? "yes" : "no";\n',
} as const;

const assertTernaryDiagnostics = (output: string, source: string): void => {
  const diagnostics = output
    .split("\n")
    .filter((line): boolean => line.includes("[Error/eslint(no-ternary)]"));
  expect(
    diagnostics
      .filter((line): boolean => line.includes("plain-ternary.ts:"))
      .join("\n")
  ).toMatch(/^[^\n]*plain-ternary\.ts:[^\n]*$/u);
  expect(
    diagnostics
      .filter((line): boolean => line.includes("nested-callback.ts:"))
      .join("\n")
  ).toMatch(/^[^\n]*nested-callback\.ts:[^\n]*$/u);
  expect(
    diagnostics.filter((line): boolean => line.includes("annotated-value.ts:"))
  ).toEqual([]);
  expect(
    diagnostics.filter((line): boolean => line.includes("guard-return.ts:"))
  ).toEqual([]);
  expect(output.includes("[Warning/eslint(no-ternary)]"), source).toBe(false);
};

/* oxlint-disable oxc/no-async-await -- The native policy probe drains both native child pipes and awaits exit before asserting its diagnostics. */
const checkTernaryPolicy = async (
  temporary: string,
  source: string
): Promise<void> => {
  const { output, exitCode } = await runNative(temporary, [
    "-c",
    path.join(temporary, "oxlint.config.ts"),
    ...Object.keys(ternaryPolicyFixtures).map((file): string =>
      path.join(temporary, file)
    ),
    "--format",
    "unix",
  ]);
  expect(exitCode, source).toBe(diagnosticFailureExit);
  assertTernaryDiagnostics(output, source);
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- This Bun test awaits isolated fixture writes and sequential repository/standalone policy probes, then removes its temporary directory. */
test(
  "ternary restrictions remain enabled while source exceptions leave callback returns visible",
  async (): Promise<void> => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "chatjs-lint-ternary-")
    );
    try {
      await settleChecks(
        Object.entries(ternaryPolicyFixtures).map(
          ([file, contents]: readonly [
            string,
            string,
          ]): (() => Promise<void>) =>
            async (): Promise<void> =>
              await writeFile(path.join(temporary, file), contents)
        )
      );
      await writeConfig(temporary, "oxlint.config.ts");
      await checkTernaryPolicy(temporary, "oxlint.config.ts");
      await writeConfig(temporary, "apps/chat/oxlint.config.ts");
      await checkTernaryPolicy(temporary, "apps/chat/oxlint.config.ts");
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);
/* oxlint-enable oxc/no-async-await */
