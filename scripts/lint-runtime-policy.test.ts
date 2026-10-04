import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const permitted = [
  "packages/cli/src/probe.ts",
  "packages/cli/test/probe.ts",
  "packages/cli/scripts/probe.ts",
  "scripts/probe.ts",
  "apps/electron/src/main.ts",
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

const standalonePermitted = [
  "electron/src/main.ts",
  "electron/scripts/probe.ts",
  "electron/forge.config.ts",
];
const standaloneProtected = [
  "electron/src/preload.ts",
  "electron/src/renderer.ts",
  "components/probe.ts",
];

const writeFixture = async (temporary: string, file: string): Promise<void> => {
  const destination = path.join(temporary, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(
    destination,
    'import fs from "node:fs";\nexport const exists = fs.existsSync;\n'
  );
};

const childDeadlineMs = 10_000;
const testDeadlineMs = 30_000;
const diagnosticFailureExit = 1;

const assertDiagnostics = (
  output: string,
  cwd: string,
  files: readonly string[]
): void => {
  for (const file of files) {
    const diagnostics = output
      .split("\n")
      .filter((line): boolean => line.includes(`/${file}:`));
    expect(diagnostics, `${cwd}: ${file}`).not.toEqual([]);
    expect(
      diagnostics.some((line): boolean =>
        line.includes("[Error/import(no-nodejs-modules)]")
      ),
      `${cwd}: ${file}`
    ).toBe(protectedPaths.includes(file) || standaloneProtected.includes(file));
    expect(
      diagnostics.some((line): boolean =>
        line.includes("[Warning/import(no-nodejs-modules)]")
      ),
      `${cwd}: ${file}`
    ).toBe(false);
  }
};

const checkBoundary = async (
  temporary: string,
  cwd: string,
  files: readonly string[]
): Promise<void> => {
  const result = Bun.spawn(
    [
      process.execPath,
      "--bun",
      path.join(root, "node_modules/oxlint/bin/oxlint"),
      "-c",
      path.join(temporary, "oxlint.config.ts"),
      ...files.map((file): string => path.join(temporary, file)),
      "--format",
      "unix",
    ],
    { cwd: path.join(temporary, cwd), stderr: "pipe", stdout: "pipe" }
  );
  const deadline = setTimeout((): void => {
    result.kill("SIGKILL");
  }, childDeadlineMs);
  try {
    const [output, errors, exitCode] = await Promise.all([
      new Response(result.stdout).text(),
      new Response(result.stderr).text(),
      result.exited,
    ]);
    expect(errors, cwd).toBe("");
    expect(exitCode, cwd).toBe(diagnosticFailureExit);
    assertDiagnostics(output, cwd, files);
  } finally {
    clearTimeout(deadline);
    result.kill("SIGKILL");
    await result.exited;
  }
};

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

const writeConfig = async (
  temporary: string,
  source: string
): Promise<void> => {
  await writeFile(
    path.join(temporary, "oxlint.config.ts"),
    `import config from ${JSON.stringify(path.join(root, source))};\nexport default { ...config, options: { typeAware: false } };\n`
  );
};

test(
  "Node import policy preserves browser boundaries across working directories",
  async (): Promise<void> => {
    const temporary = await mkdtemp(
      path.join(tmpdir(), "chatjs-lint-runtime-")
    );
    try {
      await writeConfig(temporary, "oxlint.config.ts");
      const files = [...permitted, ...protectedPaths];
      await settleChecks(
        [...files, ...standalonePermitted, ...standaloneProtected].map(
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
                [...standalonePermitted, ...standaloneProtected].filter(
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
