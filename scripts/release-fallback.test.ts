import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

// Exercise the actual workflow function with fake external services. No credentials,
// npm publication, GitHub writes, or changes to the checkout are involved.
const workflow = Bun.YAML.parse(
  await Bun.file(
    new URL("../.github/workflows/release.yml", import.meta.url)
  ).text()
);
const step = workflow.jobs.release.steps.find(
  (candidate: { name?: string }) =>
    candidate.name === "Publish first-time packages"
);
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

test("retry repairs release metadata without republishing after verification fails", async () => {
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

test("retry pushes an existing local tag after the first push fails", async () => {
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

for (const lookupFails of [false, true]) {
  test(
    lookupFails
      ? "registry authentication failure never triggers publication"
      : "missing version publishes and creates release metadata",
    async () => {
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
