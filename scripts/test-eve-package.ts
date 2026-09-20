import { execFileSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const [argument] = process.argv.slice(2);
if (!argument) {
  throw new Error(
    "Usage: bun run eve:test-package /absolute/path/to/chat-js-eve.tgz"
  );
}
const archive = path.resolve(argument);
const candidate = JSON.parse(
  execFileSync("tar", ["-xOf", archive, "package/package.json"], {
    encoding: "utf-8",
  })
);
if (candidate.name !== "@chat-js/eve") {
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
const run = (args: string[], cwd = root) =>
  execFileSync("bun", args, { cwd, stdio: "inherit" });

try {
  await Promise.all(
    originals
      .filter(({ file }) => manifestPaths.includes(file))
      .map(({ content, file }) => {
        const manifest = JSON.parse(content);
        manifest.dependencies.eve = `file:${archive}`;
        return writeFile(
          path.join(root, file),
          `${JSON.stringify(manifest, null, 2)}\n`
        );
      })
  );
  run(["install", "--ignore-scripts"]);
  await Promise.all(
    originals
      .filter(({ file }) => manifestPaths.includes(file))
      .map(({ content, file }) => writeFile(path.join(root, file), content))
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
    originals.map(({ content, file }) =>
      writeFile(path.join(root, file), content)
    )
  );
}
