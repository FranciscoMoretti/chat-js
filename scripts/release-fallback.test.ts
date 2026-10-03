import { expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- the node:fs/promises import: The fixture uses this Node API to isolate and inspect its temporary files/processes. */
import { mkdtemp, rm } from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- the node:os import: The fixture uses this Node API to isolate and inspect its temporary files/processes. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable eslint/sort-imports -- the node:path import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
/* oxlint-disable import/no-nodejs-modules -- the node:path import: The fixture uses this Node API to isolate and inspect its temporary files/processes. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable node/no-top-level-await -- workflow: The test module must finish asynchronous fixture initialization before registering dependent scenarios. */
// Exercise the actual workflow function with fake external services. No credentials,
// npm publication, GitHub writes, or changes to the checkout are involved.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- This fixture reads the repository-owned GitHub workflow shape and exercises the extracted publish function.
const workflow = Bun.YAML.parse(
  await Bun.file(
    new URL("../.github/workflows/release.yml", import.meta.url)
  ).text()
) as { jobs: { release: { steps: { name?: string; run: string }[] } } };
/* oxlint-enable node/no-top-level-await */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- step: The test intentionally exercises mutable SDK/fixture objects; deep-readonly parameters would change their assignability. */
const step = workflow.jobs.release.steps.find(
  (candidate: { name?: string }): boolean =>
    candidate.name === "Publish first-time packages"
);
/* oxlint-enable typescript/prefer-readonly-parameter-types */
if (!step) {
  throw new Error("Missing publish fallback workflow step");
}
const fallback = step.run.slice(step.run.indexOf("publish_if_missing()"));

const services = `
node() {
  if [ "$1" = "-p" ]; then
    case "$2" in
      *.name) echo '@chat-js/thread' ;;
      *.version) echo '0.1.0' ;;
      *) return 1 ;;
    esac
  else
    command node "$@"
  fi
}
npm() {
  echo "npm $*" >> calls
  if [ -f fail-lookup ]; then echo '{"error":{"code":"E401"}}'; return 1; fi
  if [ "$1" = publish ]; then touch published; return 0; fi
  if [ -f published ]; then
    if [ "$#" = 3 ] && [ -f fail-verification ]; then return 1; fi
    if [ "$#" = 3 ]; then echo '0.1.0'; else echo '"0.1.0"'; fi
    return 0
  fi
  echo '{"error":{"code":"E404"}}'
  return 1
}
bun() { echo "bun $*" >> calls; }
git() {
  echo "git $*" >> calls
  case "$1" in
    rev-parse) test -f tagged ;;
    tag) touch tagged ;;
    push) test ! -f fail-push ;;
    *) return 1 ;;
  esac
}
gh() {
  echo "gh $*" >> calls
  case "$2" in
    view) test -f released ;;
    create) touch released ;;
    *) return 1 ;;
  esac
}
`;

/* oxlint-disable eslint/max-statements -- retry repairs release metadata without republishing after verification fails: Keep setup, action and assertions together so this scenario's ordering and cleanup remain reviewable. */
/* oxlint-disable oxc/no-async-await -- retry repairs release metadata without republishing after verification fails: Await ordering defines fixture setup, observed completion and cleanup for this scenario. */
/* oxlint-disable typescript/explicit-function-return-type -- retry repairs release metadata without republishing after verification fails: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable node/no-sync -- retry repairs release metadata without republishing after verification fails: Synchronous fixture setup/readback keeps each assertion tied to a completed filesystem/process boundary. */
/* oxlint-disable eslint/no-magic-numbers -- retry repairs release metadata without republishing after verification fails: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
test("retry repairs release metadata without republishing after verification fails", async (): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-release-test-"));
  try {
    const run = () =>
      Bun.spawnSync(["bash", "-euo", "pipefail", "-c", services + fallback], {
        cwd: directory,
      });
    await Bun.write(path.join(directory, "fail-verification"), "");
    expect(run().exitCode).not.toBe(0);
    expect(await Bun.file(path.join(directory, "published")).exists()).toBe(
      true
    );
    expect(await Bun.file(path.join(directory, "tagged")).exists()).toBe(false);
    await rm(path.join(directory, "fail-verification"));
    expect(run().exitCode).toBe(0);
    expect(await Bun.file(path.join(directory, "released")).exists()).toBe(
      true
    );
    expect(run().exitCode).toBe(0);
    const calls = await Bun.file(path.join(directory, "calls")).text();
    expect(calls.match(/^npm publish /gmu)).toHaveLength(1);
    expect(calls.match(/^git tag /gmu)).toHaveLength(1);
    expect(calls.match(/^gh release create /gmu)).toHaveLength(1);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/max-statements -- retry pushes an existing local tag after the first push fails: Keep setup, action and assertions together so this scenario's ordering and cleanup remain reviewable. */
/* oxlint-disable oxc/no-async-await -- retry pushes an existing local tag after the first push fails: Await ordering defines fixture setup, observed completion and cleanup for this scenario. */
/* oxlint-disable typescript/explicit-function-return-type -- retry pushes an existing local tag after the first push fails: Keep contextual/generic inference for this SDK, callback or composite result; a new explicit type requires choosing its public shape. */
/* oxlint-disable node/no-sync -- retry pushes an existing local tag after the first push fails: Synchronous fixture setup/readback keeps each assertion tied to a completed filesystem/process boundary. */
/* oxlint-disable eslint/no-magic-numbers -- retry pushes an existing local tag after the first push fails: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
test("retry pushes an existing local tag after the first push fails", async (): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-release-test-"));
  try {
    const run = () =>
      Bun.spawnSync(["bash", "-euo", "pipefail", "-c", services + fallback], {
        cwd: directory,
      });
    await Bun.write(path.join(directory, "published"), "");
    await Bun.write(path.join(directory, "fail-push"), "");
    expect(run().exitCode).not.toBe(0);
    expect(await Bun.file(path.join(directory, "tagged")).exists()).toBe(true);
    expect(await Bun.file(path.join(directory, "released")).exists()).toBe(
      false
    );
    await rm(path.join(directory, "fail-push"));
    expect(run().exitCode).toBe(0);
    expect(await Bun.file(path.join(directory, "released")).exists()).toBe(
      true
    );
    const calls = await Bun.file(path.join(directory, "calls")).text();
    expect(calls).not.toContain("npm publish");
    expect(calls.match(/^git push /gmu)).toHaveLength(2);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
});
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/max-statements */

/* oxlint-disable eslint/no-ternary -- release-fallback.test.ts: The expression preserves the existing fallback/derived-value contract within this operation. */
/* oxlint-disable oxc/no-async-await -- release-fallback.test.ts: Await ordering defines fixture setup, observed completion and cleanup for this scenario. */
/* oxlint-disable node/no-sync -- release-fallback.test.ts: Synchronous fixture setup/readback keeps each assertion tied to a completed filesystem/process boundary. */
/* oxlint-disable eslint/no-magic-numbers -- release-fallback.test.ts: Literal IDs, expected counts and timing bounds belong to this fixed scenario and its assertions. */
for (const lookupFails of [false, true]) {
  test(
    lookupFails
      ? "registry authentication failure never triggers publication"
      : "missing version publishes and creates release metadata",
    async (): Promise<void> => {
      const directory = await mkdtemp(
        path.join(tmpdir(), "chatjs-release-test-")
      );
      try {
        if (lookupFails) {
          await Bun.write(path.join(directory, "fail-lookup"), "");
        }
        const result = Bun.spawnSync(
          ["bash", "-euo", "pipefail", "-c", services + fallback],
          { cwd: directory }
        );
        expect(result.exitCode === 0).toBe(!lookupFails);
        expect(await Bun.file(path.join(directory, "published")).exists()).toBe(
          !lookupFails
        );
        expect(await Bun.file(path.join(directory, "released")).exists()).toBe(
          !lookupFails
        );
      } finally {
        await rm(directory, { force: true, recursive: true });
      }
    }
  );
}
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable eslint/no-ternary */
