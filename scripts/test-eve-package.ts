import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
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
const candidate: unknown = JSON.parse(
  execFileSync("tar", ["-xOf", archive, "package/package.json"], {
    encoding: "utf-8",
  })
);
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
const originals = await Promise.all(
  [...manifestPaths, "bun.lock"].map(async (file) => ({
    content: await readFile(path.join(root, file), "utf-8"),
    file,
  }))
);
const run = (args: readonly string[], cwd = root): Buffer =>
  execFileSync("bun", args, { cwd, stdio: "inherit" });

try {
  await Promise.all(
    originals
      .filter(({ file }: Readonly<(typeof originals)[number]>): boolean =>
        manifestPaths.includes(file)
      )
      .map(
        // oxlint-disable-next-line typescript/promise-function-async -- Fail malformed manifest validation synchronously so map stops scheduling writes before finally restores originals; async rejection would let remaining writes race restoration.
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
  await Promise.all(
    originals
      .filter(({ file }: Readonly<(typeof originals)[number]>): boolean =>
        manifestPaths.includes(file)
      )
      .map(
        async ({
          content,
          file,
        }: Readonly<(typeof originals)[number]>): Promise<void> => {
          await writeFile(path.join(root, file), content);
        }
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
  await Promise.all(
    originals.map(
      async ({
        content,
        file,
      }: Readonly<(typeof originals)[number]>): Promise<void> => {
        await writeFile(path.join(root, file), content);
      }
    )
  );
}
