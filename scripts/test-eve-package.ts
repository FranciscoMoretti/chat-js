import { readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  writeEvePackageManifests,
  writePackageFiles,
} from "./test-eve-manifests";

const COMMAND_ARGUMENTS_START_INDEX = 2;
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
  "apps/chat/guest/package.json",
  "apps/chat/tests/eve-fixture/package.json",
  "packages/registry/package.json",
];
const originals = await Promise.all(
  [...manifestPaths, "bun.lock"].map(async (file) => ({
    content: await readFile(path.join(root, file), "utf-8"),
    file,
  }))
);
const run = (args: readonly string[], cwd = root): Buffer =>
  execFileSync("bun", args, { cwd, stdio: "inherit" });
const manifestOriginals = originals.filter(
  ({ file }: Readonly<(typeof originals)[number]>): boolean =>
    manifestPaths.includes(file)
);
const writePackageFile = async (
  file: string,
  content: string
): Promise<void> => {
  await writeFile(path.join(root, file), content);
};

try {
  await writeEvePackageManifests(manifestOriginals, archive, writePackageFile);
  run(["install", "--ignore-scripts"]);
  await writePackageFiles(manifestOriginals, writePackageFile);
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
      "lib/db/eve-model-ledger.test.ts",
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
  await writePackageFiles(originals, writePackageFile);
}
