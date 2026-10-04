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

const writeFixture = async (temporary: string, file: string): Promise<void> => {
  const destination = path.join(temporary, file);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(
    destination,
    'import fs from "node:fs";\nexport const exists = fs.existsSync;\n'
  );
};

const checkBoundary = async (
  temporary: string,
  cwd: string,
  file: string
): Promise<void> => {
  const result = Bun.spawn(
    [
      "bun",
      "--bun",
      path.join(root, "node_modules/oxlint/bin/oxlint"),
      "-c",
      path.join(temporary, "oxlint.config.ts"),
      path.join(temporary, file),
      "--format",
      "unix",
    ],
    { cwd: path.join(temporary, cwd), stderr: "pipe", stdout: "pipe" }
  );
  const output = await new Response(result.stdout).text();
  const errors = await new Response(result.stderr).text();
  await result.exited;
  expect(errors, `${cwd}: ${file}`).toBe("");
  expect(output, `${cwd}: ${file}`).toContain(file);
  expect(output.includes("import(no-nodejs-modules)"), `${cwd}: ${file}`).toBe(
    protectedPaths.includes(file)
  );
};

test("Node import policy preserves browser boundaries across working directories", async (): Promise<void> => {
  const temporary = await mkdtemp(path.join(tmpdir(), "chatjs-lint-runtime-"));
  try {
    await writeFile(
      path.join(temporary, "oxlint.config.ts"),
      `import config from ${JSON.stringify(path.join(root, "oxlint.config.ts"))};\nexport default { ...config, options: { typeAware: false } };\n`
    );
    const files = [...permitted, ...protectedPaths];
    await Promise.all(
      files.map(
        async (file): Promise<void> => await writeFixture(temporary, file)
      )
    );
    await Promise.all(
      [".", "packages/cli", "apps/electron"].flatMap((cwd): Promise<void>[] =>
        files
          .filter((file): boolean => cwd === "." || file.startsWith(`${cwd}/`))
          .map(
            async (file): Promise<void> =>
              await checkBoundary(temporary, cwd, file)
          )
      )
    );
    await writeFile(
      path.join(temporary, "oxlint.config.ts"),
      `import config from ${JSON.stringify(path.join(root, "apps/chat/oxlint.config.ts"))};\nexport default { ...config, options: { typeAware: false } };\n`
    );
    await checkBoundary(temporary, ".", "apps/chat/components/probe.ts");
  } finally {
    await rm(temporary, { force: true, recursive: true });
  }
});
