import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- The policy probe resolves the repository's pinned Oxlint executable.
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const oxlint = path.join(root, "node_modules/oxlint/bin/oxlint");
const successExitCode = 0;
const ruleAllowList =
  /"import\/no-unassigned-import": \[\s*"deny",[\s\S]*?"allow": \[\s*"\*\*\/\*\.css",\s*"server-only"\s*\]/u;
const nextEnvOverride =
  /"files": \[\s*"\*\*\/next-env\.d\.ts"\s*\][\s\S]{0,160}"import\/no-unassigned-import": "allow"/u;

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
  const outputs = [rootConfig, standaloneConfig];
  for (const output of outputs) {
    expect(output).toMatch(ruleAllowList);
    expect(output).toMatch(nextEnvOverride);
  }
});
/* oxlint-enable oxc/no-async-await */
