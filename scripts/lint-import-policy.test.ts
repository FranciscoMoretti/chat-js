import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- The policy probe resolves the repository's pinned Oxlint executable.
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const oxlint = path.join(root, "node_modules/oxlint/bin/oxlint");
const successExitCode = 0;
const oneMatchingOverrideCount = 1;
const firstMatchingOverrideIndex = 0;
const importRule = "import/no-unassigned-import";
const nextEnvGlob = "**/next-env.d.ts";
const jsonNull: unknown = JSON.parse("null");
const expectedRule = ["deny", [{ allow: ["**/*.css", "server-only"] }]];
const expectedNextEnvOverrideKeys = [
  "env",
  "files",
  "globals",
  "plugins",
  "rules",
];
const legacyRuleAllowList =
  /"import\/no-unassigned-import": \[\s*"deny",[\s\S]*?"allow": \[\s*"\*\*\/\*\.css",\s*"server-only"\s*\]/u;
const legacyNextEnvOverride =
  /"files": \[\s*"\*\*\/next-env\.d\.ts"\s*\][\s\S]{0,160}"import\/no-unassigned-import": "allow"/u;

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requireRecord = (
  value: unknown,
  label: Readonly<string>
): Readonly<Record<string, unknown>> => {
  if (!isRecord(value)) {
    throw new TypeError(`Expected ${label} to be an object`);
  }
  return value;
};

const isNextEnvOverride = (value: unknown): boolean => {
  if (!isRecord(value)) {
    return false;
  }
  const { files } = value;
  return (
    Array.isArray(files) &&
    files.length === oneMatchingOverrideCount &&
    files.at(firstMatchingOverrideIndex) === nextEnvGlob
  );
};

const assertImportRule = (value: unknown): void => {
  const rules = requireRecord(value, "rules");
  expect(rules[importRule]).toEqual(expectedRule);
};

const assertNullOverrideFields = (
  override: Readonly<Record<string, unknown>>
): void => {
  const { env, globals, plugins } = override;
  expect(env).toBe(jsonNull);
  expect(globals).toBe(jsonNull);
  expect(plugins).toBe(jsonNull);
};

const assertNextEnvRules = (value: unknown): void => {
  const rules = requireRecord(value, "next-env rules");
  expect(Object.keys(rules)).toEqual([importRule]);
  expect(rules[importRule]).toBe("allow");
};

const assertNextEnvOverridePolicy = (value: unknown): void => {
  const override = requireRecord(value, "next-env override");
  const { files, rules } = override;
  expect(Object.keys(override).toSorted()).toEqual(expectedNextEnvOverrideKeys);
  expect(files).toEqual([nextEnvGlob]);
  assertNullOverrideFields(override);
  assertNextEnvRules(rules);
};

const assertEffectivePolicy = (output: Readonly<string>): void => {
  const parsed: unknown = JSON.parse(output);
  const configuration = requireRecord(parsed, "printed configuration");
  const { overrides: rawOverrides, rules: rawRules } = configuration;
  assertImportRule(rawRules);

  if (!Array.isArray(rawOverrides)) {
    throw new TypeError("Expected printed overrides to be an array");
  }
  const matchingOverrides = rawOverrides.filter((override): boolean =>
    isNextEnvOverride(override)
  );
  expect(matchingOverrides).toHaveLength(oneMatchingOverrideCount);
  assertNextEnvOverridePolicy(matchingOverrides.at(firstMatchingOverrideIndex));
};

/* oxlint-disable oxc/no-async-await -- The effective-config probe drains Oxlint's subprocess output and exit; node/no-sync forbids the synchronous alternative. */
const readEffectiveConfig = async (
  configPath: Readonly<string>,
  cwd: Readonly<string>
): Promise<string> => {
  const result = Bun.spawn(
    [
      process.execPath,
      "--bun",
      oxlint,
      "--config",
      configPath,
      "--print-config",
    ],
    { cwd, stderr: "pipe", stdout: "pipe" }
  );
  const [output, errors, exitCode] = await Promise.all([
    new Response(result.stdout).text(),
    new Response(result.stderr).text(),
    result.exited,
  ]);
  expect(exitCode, errors).toBe(successExitCode);
  return output;
};

test("root and standalone configs keep the unassigned-import rule narrow", async () => {
  const rootConfig = await readEffectiveConfig(
    path.join(root, "oxlint.config.ts"),
    root
  );
  const standaloneConfig = await readEffectiveConfig(
    path.join(root, "apps/chat/oxlint.config.ts"),
    path.join(root, "apps/chat")
  );

  assertEffectivePolicy(rootConfig);
  assertEffectivePolicy(standaloneConfig);
});

test("policy assertions reject lookalike values in unrelated entries", () => {
  const wrongRootOptions = `{"rules":{"import/no-unassigned-import": ["deny",[{"allow": ["**/*.scss"]}]],"other/import-rule": ["deny",[{"allow": ["**/*.css","server-only"]}]]},"overrides":[{"files": ["**/next-env.d.ts"],"rules": {"import/no-unassigned-import": "allow"}}]}`;
  const wrongNextEnvSeverity = `{"rules":{"import/no-unassigned-import": ["deny",[{"allow": ["**/*.css","server-only"]}]]},"overrides":[{"files": ["**/next-env.d.ts"],"rules": {"import/no-unassigned-import": "deny"}},{"files": ["**/other-generated.d.ts"],"rules": {"import/no-unassigned-import": "allow"}}]}`;

  expect(wrongRootOptions).toMatch(legacyRuleAllowList);
  expect(() => assertEffectivePolicy(wrongRootOptions)).toThrow();

  expect(wrongNextEnvSeverity).toMatch(legacyNextEnvOverride);
  expect(() => assertEffectivePolicy(wrongNextEnvSeverity)).toThrow();
});
/* oxlint-enable oxc/no-async-await */
