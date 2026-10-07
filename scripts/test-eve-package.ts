// oxlint-disable-next-line import/no-nodejs-modules -- The package verification command builds a local fixture and launches its runtime as a subprocess.
import { execFileSync } from "node:child_process";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
// oxlint-disable-next-line import/no-nodejs-modules -- The package verification command builds a local fixture and launches its runtime as a subprocess.
import { readFile, writeFile } from "node:fs/promises";
/* oxlint-enable sort-imports */
// oxlint-disable-next-line import/no-nodejs-modules -- The package verification command builds a local fixture and launches its runtime as a subprocess.
import path from "node:path";

const COMMAND_ARGUMENTS_START_INDEX = 2;
const MANIFEST_INDENTATION_SPACES = 2;
const root = path.resolve(import.meta.dir, "..");
const [argument] = process.argv.slice(COMMAND_ARGUMENTS_START_INDEX);
if (!argument) {
  throw new Error(
    "Usage: bun run eve:test-package /absolute/path/to/chat-js-eve.tgz"
  );
}
const archive = path.resolve(argument);
/* oxlint-disable node/no-sync -- candidate: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
const candidate: unknown = JSON.parse(
  execFileSync("tar", ["-xOf", archive, "package/package.json"], {
    encoding: "utf-8",
  })
);
/* oxlint-enable node/no-sync */
if (
  typeof candidate !== "object" ||
  candidate === null ||
  !("name" in candidate) ||
  candidate.name !== "@chat-js/eve"
) {
  throw new Error("Expected a packed @chat-js/eve distribution.");
}
const manifestPaths = [
  "apps/chat/package.json",
  "apps/chat/tests/eve-fixture/package.json",
];
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve originals's awaited sequencing and rejected-Promise behavior. */
// oxlint-disable-next-line node/no-top-level-await -- This Bun package-validation executable saves manifests and lockfile contents before temporary edits.
const originals = await Promise.all(
  [...manifestPaths, "bun.lock"].map(async (file) => ({
    content: await readFile(path.join(root, file), "utf-8"),
    file,
  }))
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable node/no-sync -- run: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
const run = (args: readonly string[], cwd = root): Buffer =>
  execFileSync("bun", args, { cwd, stdio: "inherit" });
/* oxlint-enable node/no-sync */

/* oxlint-disable unicorn/no-null -- test-eve-package.ts: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable typescript/promise-function-async -- test-eve-package.ts: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
try {
  // oxlint-disable-next-line node/no-top-level-await -- This Bun package-validation executable finishes temporary manifest rewrites before installing the local package.
  await Promise.all(
    originals
      .filter(({ file }: Readonly<(typeof originals)[number]>): boolean =>
        manifestPaths.includes(file)
      )
      .map(
        ({
          content,
          file,
        }: Readonly<(typeof originals)[number]>): Promise<void> => {
          const manifest: unknown = JSON.parse(content);
          if (
            typeof manifest !== "object" ||
            manifest === null ||
            !("dependencies" in manifest) ||
            typeof manifest.dependencies !== "object" ||
            manifest.dependencies === null
          ) {
            throw new Error(`Expected dependencies in ${file}`);
          }
          Object.assign(manifest.dependencies, { eve: `file:${archive}` });
          return writeFile(
            path.join(root, file),
            `${JSON.stringify(manifest, null, MANIFEST_INDENTATION_SPACES)}\n`
          );
        }
      )
  );
  run(["install", "--ignore-scripts"]);
  // oxlint-disable-next-line node/no-top-level-await -- This Bun package-validation executable restores manifest declarations after dependency installation.
  await Promise.all(
    originals
      .filter(({ file }: Readonly<(typeof originals)[number]>): boolean =>
        manifestPaths.includes(file)
      )
      .map(
        ({
          content,
          file,
        }: Readonly<(typeof originals)[number]>): Promise<void> =>
          writeFile(path.join(root, file), content)
      )
  );
  run(["lint"]);
  run(["test:types"]);
  run(
    [
      "x",
      "vitest",
      "run",
      "lib/eve",
      "lib/ai/mcp",
      "tools/platform/deep-research",
      "tests/eve-mcp-native-approval.test.ts",
      "lib/db/eve-sandbox-run-coverage.test.ts",
    ],
    path.join(root, "apps/chat")
  );
  run([
    "test",
    "--timeout",
    "30000",
    "packages/cli/src/helpers/vendor-patched-package.test.ts",
    "packages/cli/src/helpers/scaffold-contract.test.ts",
    "packages/cli/src/helpers/scaffold-content.test.ts",
    "packages/cli/src/helpers/scaffold.test.ts",
  ]);
} finally {
  // Local tarball paths and their lockfile entries must never leak into a PR.
  // oxlint-disable-next-line node/no-top-level-await -- This Bun package-validation executable awaits restoration of manifests and lockfile even when validation fails.
  await Promise.all(
    originals.map(
      ({
        content,
        file,
      }: Readonly<(typeof originals)[number]>): Promise<void> =>
        writeFile(path.join(root, file), content)
    )
  );
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable unicorn/no-null */
