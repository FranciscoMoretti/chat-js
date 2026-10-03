/* oxlint-disable import/no-nodejs-modules -- the node:child_process import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { execFileSync } from "node:child_process";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- the node:fs/promises import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
/* oxlint-disable import/no-nodejs-modules -- the node:fs/promises import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import { readFile, writeFile } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: This command runs in Node/Bun and requires the imported filesystem/process/path API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

const root = path.resolve(import.meta.dir, "..");
/* oxlint-disable eslint/no-magic-numbers -- [argument]: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
const [argument] = process.argv.slice(2);
/* oxlint-enable eslint/no-magic-numbers */
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
/* oxlint-disable node/no-top-level-await -- originals: This Bun/ESM entrypoint must finish initialization before later module statements run. */
/* oxlint-disable oxc/no-async-await -- originals: Await sequencing preserves this operation's dependent I/O and error propagation. */
const originals = await Promise.all(
  [...manifestPaths, "bun.lock"].map(async (file) => ({
    content: await readFile(path.join(root, file), "utf-8"),
    file,
  }))
);
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable typescript/explicit-function-return-type -- run: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable node/no-sync -- run: Startup/discovery consumes this synchronous OS/filesystem API before dependent commands run. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- run: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
const run = (args: string[], cwd = root) =>
  execFileSync("bun", args, { cwd, stdio: "inherit" });
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable node/no-sync */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable node/no-top-level-await -- test-eve-package.ts: This Bun/ESM entrypoint must finish initialization before later module statements run. */
/* oxlint-disable unicorn/no-null -- test-eve-package.ts: The SDK/wire/OS contract uses null as an explicit absence value. */
/* oxlint-disable eslint/no-magic-numbers -- test-eve-package.ts: Exit/status codes, timeouts and OS/protocol bounds retain this command's operational contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- test-eve-package.ts: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
/* oxlint-disable typescript/promise-function-async -- test-eve-package.ts: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
try {
  await Promise.all(
    originals
      .filter(({ file }): boolean => manifestPaths.includes(file))
      .map(({ content, file }): Promise<void> => {
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
          `${JSON.stringify(manifest, null, 2)}\n`
        );
      })
  );
  run(["install", "--ignore-scripts"]);
  await Promise.all(
    originals
      .filter(({ file }): boolean => manifestPaths.includes(file))
      .map(({ content, file }): Promise<void> =>
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
  await Promise.all(
    originals.map(({ content, file }): Promise<void> =>
      writeFile(path.join(root, file), content)
    )
  );
}
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable node/no-top-level-await */
