import { expect, test } from "bun:test";
// oxlint-disable-next-line import/no-nodejs-modules -- The release fallback tests construct isolated package-manager fixtures on the host filesystem.
import { mkdtemp, rm } from "node:fs/promises";
// oxlint-disable-next-line import/no-nodejs-modules -- The release fallback tests construct isolated package-manager fixtures on the host filesystem.
import { tmpdir } from "node:os";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
// oxlint-disable-next-line import/no-nodejs-modules -- The release fallback tests construct isolated package-manager fixtures on the host filesystem.
import path from "node:path";
/* oxlint-enable sort-imports */

const SUCCESS_EXIT_CODE = 0;
const NON_SUCCESS_EXIT_CODE = 1;
const ONE_PUBLICATION = 1;
const ONE_CREATED_TAG = 1;
const ONE_CREATED_RELEASE = 1;
const TWO_TAG_PUSHES = 2;

type ReleaseFileState = Readonly<{
  published: boolean;
  tagged: boolean;
  released: boolean;
}>;

type ReleaseAssertion = (directory: string) => Promise<void>;

// Exercise the actual workflow function with fake external services. No credentials,
// npm publication, GitHub writes, or changes to the checkout are involved.
const parsedWorkflow: unknown = Bun.YAML.parse(
  // oxlint-disable-next-line node/no-top-level-await -- This Bun suite reads the release workflow before registering publication-fallback contract assertions.
  await Bun.file(
    new URL("../.github/workflows/release.yml", import.meta.url)
  ).text()
);

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const isPublishFallbackStep = (
  value: unknown
): value is Readonly<{ name: string; run: string }> =>
  isRecord(value) &&
  value.name === "Publish first-time packages" &&
  typeof value.run === "string";

const hasReleaseSteps = (
  value: unknown
): value is Readonly<{
  jobs: Readonly<{ release: Readonly<{ steps: readonly unknown[] }> }>;
}> => {
  if (!isRecord(value)) {
    return false;
  }
  const { jobs } = value;
  if (!isRecord(jobs)) {
    return false;
  }
  const { release } = jobs;
  if (!isRecord(release)) {
    return false;
  }
  return Array.isArray(release.steps);
};

const getPublishFallback = (workflow: unknown): string => {
  if (!hasReleaseSteps(workflow)) {
    throw new TypeError("Missing publish fallback workflow step");
  }
  const {
    jobs: {
      release: { steps },
    },
  } = workflow;
  const step = steps.find((candidate) => isPublishFallbackStep(candidate));
  if (!step) {
    throw new TypeError("Missing publish fallback workflow step");
  }
  return step.run.slice(step.run.indexOf("publish_if_missing()"));
};

const fallback = getPublishFallback(parsedWorkflow);

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

const runFallback = async (cwd: string): Promise<number> => {
  const child = Bun.spawn(
    ["bash", "-euo", "pipefail", "-c", services + fallback],
    { cwd, stderr: "ignore", stdout: "ignore" }
  );
  const exitCode = await child.exited;
  // These assertions only distinguish success from failure. Preserve the
  // spawnSync behavior where a signal-terminated child does not count as zero.
  return child.signalCode ? NON_SUCCESS_EXIT_CODE : exitCode;
};

const withReleaseDirectory = async (
  assertRelease: ReleaseAssertion
): Promise<void> => {
  const directory = await mkdtemp(path.join(tmpdir(), "chatjs-release-test-"));
  try {
    await assertRelease(directory);
  } finally {
    await rm(directory, { force: true, recursive: true });
  }
};

const expectReleaseFiles = async (
  directory: string,
  expected: ReleaseFileState
): Promise<void> => {
  const actual = {
    published: await Bun.file(path.join(directory, "published")).exists(),
    released: await Bun.file(path.join(directory, "released")).exists(),
    tagged: await Bun.file(path.join(directory, "tagged")).exists(),
  };
  expect(actual).toEqual(expected);
};

const expectCallCounts = async (
  directory: string,
  expected: readonly Readonly<{ count: number; pattern: string }>[]
): Promise<void> => {
  const calls = await Bun.file(path.join(directory, "calls")).text();
  for (const { count, pattern } of expected) {
    expect(calls.match(new RegExp(pattern, "gmu"))).toHaveLength(count);
  }
};

test("retry repairs release metadata without republishing after verification fails", async (): Promise<void> => {
  await withReleaseDirectory(async (directory) => {
    await Bun.write(path.join(directory, "fail-verification"), "");
    expect(await runFallback(directory)).not.toBe(SUCCESS_EXIT_CODE);
    await expectReleaseFiles(directory, {
      published: true,
      released: false,
      tagged: false,
    });
    await rm(path.join(directory, "fail-verification"));
    expect(await runFallback(directory)).toBe(SUCCESS_EXIT_CODE);
    await expectReleaseFiles(directory, {
      published: true,
      released: true,
      tagged: true,
    });
    expect(await runFallback(directory)).toBe(SUCCESS_EXIT_CODE);
    await expectCallCounts(directory, [
      { count: ONE_PUBLICATION, pattern: "^npm publish " },
      { count: ONE_CREATED_TAG, pattern: "^git tag " },
      { count: ONE_CREATED_RELEASE, pattern: "^gh release create " },
    ]);
  });
});

test("retry pushes an existing local tag after the first push fails", async (): Promise<void> => {
  await withReleaseDirectory(async (directory) => {
    await Bun.write(path.join(directory, "published"), "");
    await Bun.write(path.join(directory, "fail-push"), "");
    expect(await runFallback(directory)).not.toBe(SUCCESS_EXIT_CODE);
    await expectReleaseFiles(directory, {
      published: true,
      released: false,
      tagged: true,
    });
    await rm(path.join(directory, "fail-push"));
    expect(await runFallback(directory)).toBe(SUCCESS_EXIT_CODE);
    await expectReleaseFiles(directory, {
      published: true,
      released: true,
      tagged: true,
    });
    await expectCallCounts(directory, [
      { count: TWO_TAG_PUSHES, pattern: "^git push " },
    ]);
    const calls = await Bun.file(path.join(directory, "calls")).text();
    expect(calls).not.toContain("npm publish");
  });
});

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
        const exitCode = await runFallback(directory);
        expect(exitCode === SUCCESS_EXIT_CODE).toBe(!lookupFails);
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
