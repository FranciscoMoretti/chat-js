import { expect, test } from "bun:test";
/* oxlint-disable max-lines -- The root and standalone native policy contracts share one fixture harness and cover runtime exceptions, ternaries, import formatting, and the pinned rule union. */
// oxlint-disable-next-line import/no-nodejs-modules -- These Bun lint probes create isolated project directories and resolve their source paths.
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
// oxlint-disable-next-line import/no-nodejs-modules -- These Bun lint probes create isolated project directories and resolve their source paths.
import path from "node:path";
import react from "ultracite/oxlint/react";
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
const successExitCode = 0;
const firstRuleOptionIndex = 0;
const diagnosticLocation = /^(?<filename>.+?):\d+:\d+:/u;

/* oxlint-disable oxc/no-async-await -- Drain native tool pipes and exit before checking the isolated fixture. */
const runNative = async (
  cwd: string,
  executable: "oxfmt" | "oxlint",
  args: readonly string[]
): Promise<{ output: string; exitCode: number }> => {
  const child = Bun.spawn(
    [
      process.execPath,
      "--bun",
      path.join(root, `node_modules/${executable}/bin/${executable}`),
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
  const { output, exitCode } = await runNative(
    path.join(temporary, cwd),
    "oxlint",
    [
      "-c",
      path.join(temporary, "oxlint.config.ts"),
      ...files.map((file): string => path.join(temporary, file)),
      "--format",
      "unix",
    ]
  );
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
  const { output, exitCode } = await runNative(temporary, "oxlint", [
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

const importSources = {
  "bad-declarations.ts":
    'import { Zulu, alpha } from "members";\nimport apple from "apple";\nimport Zebra from "zebra";\nexport const chosen = [Zulu, alpha, Zebra, apple];\n',
  "bad-members.ts":
    'import { alpha, Zulu } from "members";\nimport Zebra from "zebra";\nimport apple from "apple";\nexport const chosen = [Zulu, alpha, Zebra, apple];\n',
  "compliant.ts":
    'import { Zulu, alpha } from "members";\nimport Zebra from "zebra";\nimport apple from "apple";\nexport const chosen = [Zulu, alpha, Zebra, apple];\n',
} as const;

const pinnedRuleNames = new Set([
  ...Object.keys(core.rules),
  ...Object.keys(react.rules),
  ...Object.keys(next.rules),
]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const requirePrintedRules = (output: string): Record<string, unknown> => {
  const parsed: unknown = JSON.parse(output);
  if (!isRecord(parsed) || !isRecord(parsed.rules)) {
    throw new TypeError("Native config must contain rules");
  }
  return parsed.rules;
};

const assertPrintedRule = (
  rules: Readonly<Record<string, unknown>>,
  name: string,
  source: string
): void => {
  const nativeName = name
    .replace(/^jsx-a11y\//u, "jsx_a11y/")
    .replace(/^react-perf\//u, "react_perf/");
  const value = rules[nativeName];
  let severity: unknown = value;
  if (Array.isArray(value)) {
    severity = value.at(firstRuleOptionIndex);
  }
  expect(severity, `${source}: ${name}`).toBe("deny");
};

/* oxlint-disable oxc/no-async-await -- Native print-config must finish before asserting the complete pinned rule union. */
const assertEveryPinnedRuleEnabled = async (
  temporary: string,
  source: string
): Promise<void> => {
  await writeConfig(temporary, source);
  const { output, exitCode } = await runNative(temporary, "oxlint", [
    "-c",
    path.join(temporary, "oxlint.config.ts"),
    "--print-config",
  ]);
  expect(exitCode, source).toBe(successExitCode);
  const rules = requirePrintedRules(output);
  expect(Object.keys(rules), source).toHaveLength(pinnedRuleNames.size);
  for (const name of pinnedRuleNames) {
    assertPrintedRule(rules, name, source);
  }
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- The formatter and linter fixtures await each native probe before comparing output. */
const assertMalformedFormatting = async (
  temporary: string,
  source: string,
  format: (mode: "--check" | "--write", file: string) => Promise<number>
): Promise<void> => {
  const malformed = path.join(temporary, "malformed.ts");
  await writeFile(malformed, "export  const chosen={answer:42}\n");
  expect(await format("--check", malformed), source).toBe(
    diagnosticFailureExit
  );
  expect(await format("--write", malformed), source).toBe(successExitCode);
  expect(await readFile(malformed, "utf-8"), source).toBe(
    "export const chosen = { answer: 42 };\n"
  );
  expect(await format("--check", malformed), source).toBe(successExitCode);
};

const assertFormatterImportPolicy = async (
  temporary: string,
  source: string
): Promise<void> => {
  const config = path.join(temporary, "oxfmt.config.ts");
  const compliant = path.join(temporary, "compliant.ts");
  await writeFile(
    config,
    `import config from ${JSON.stringify(path.join(root, source))};\nexport default config;\n`
  );
  const format = async (
    mode: "--check" | "--write",
    file: string
  ): Promise<number> => {
    const result = await runNative(temporary, "oxfmt", [
      "-c",
      config,
      mode,
      file,
    ]);
    return result.exitCode;
  };
  expect(await format("--write", compliant), source).toBe(successExitCode);
  expect(await readFile(compliant, "utf-8"), source).toBe(
    importSources["compliant.ts"]
  );
  expect(await format("--check", compliant), source).toBe(successExitCode);
  await assertMalformedFormatting(temporary, source, format);
};

const assertNativeSortImports = async (
  temporary: string,
  source: string
): Promise<void> => {
  await writeConfig(temporary, source);
  const files = Object.keys(importSources).map((file): string =>
    path.join(temporary, file)
  );
  const { output, exitCode } = await runNative(temporary, "oxlint", [
    "-c",
    path.join(temporary, "oxlint.config.ts"),
    ...files,
    "--format",
    "unix",
  ]);
  expect(exitCode, source).toBe(diagnosticFailureExit);
  const diagnostics = output
    .split("\n")
    .filter((line): boolean => line.includes("[Error/eslint(sort-imports)]"));
  expect(
    diagnostics.some((line): boolean => line.includes("bad-members.ts:")),
    source
  ).toBe(true);
  expect(
    diagnostics.some((line): boolean => line.includes("bad-declarations.ts:")),
    source
  ).toBe(true);
  expect(
    diagnostics.some((line): boolean => line.includes("compliant.ts:")),
    source
  ).toBe(false);
};
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- The isolated formatter and linter probes run in sequence for both shipped configs. */
test(
  "native formatter preserves lint-compliant import order",
  async (): Promise<void> => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "chatjs-import-policy-")
    );
    try {
      await Promise.all(
        Object.entries(importSources).map(
          async ([file, contents]: readonly [string, string]): Promise<void> =>
            await writeFile(path.join(temporary, file), contents)
        )
      );
      await assertFormatterImportPolicy(temporary, "oxfmt.config.ts");
      await assertNativeSortImports(temporary, "oxlint.config.ts");
      await assertEveryPinnedRuleEnabled(temporary, "oxlint.config.ts");
      await assertFormatterImportPolicy(temporary, "apps/chat/oxfmt.config.ts");
      await assertNativeSortImports(temporary, "apps/chat/oxlint.config.ts");
      await assertEveryPinnedRuleEnabled(
        temporary,
        "apps/chat/oxlint.config.ts"
      );
    } finally {
      await rm(temporary, { force: true, recursive: true });
    }
  },
  testDeadlineMs
);
/* oxlint-enable oxc/no-async-await */
