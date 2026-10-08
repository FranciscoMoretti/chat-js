import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- Native CLI probes need isolated fixture directories and source files.
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
// oxlint-disable-next-line import/no-nodejs-modules -- Resolve native tool and fixture paths.
import path from "node:path";
import react from "ultracite/oxlint/react";
// oxlint-disable-next-line import/no-nodejs-modules -- Place native probe fixtures outside the checkout.
import { tmpdir } from "node:os";

const root = path.resolve(import.meta.dir, "..");
const childDeadlineMs = 10_000;
const testDeadlineMs = 30_000;
const diagnosticFailureExit = 1;
const successExitCode = 0;
const firstRuleOptionIndex = 0;

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

/* oxlint-disable oxc/no-async-await -- Write the native config fixture before starting its probe. */
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

/* oxlint-disable oxc/no-async-await -- Native print-config must finish before checking the complete pinned rule union. */
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

/* oxlint-disable oxc/no-async-await -- The formatter probes await native checks before comparing fixture contents. */
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
/* oxlint-enable oxc/no-async-await */

/* oxlint-disable oxc/no-async-await -- Native lint checks must finish before their diagnostics are inspected. */
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

/* oxlint-disable oxc/no-async-await -- Run each formatter and native linter contract, then remove the isolated fixture directory. */
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
