import { expect, test } from "bun:test";
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { tmpdir } from "node:os";
/* oxlint-enable import/no-nodejs-modules */
/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import path from "node:path";
/* oxlint-enable import/no-nodejs-modules */

const smokeTimeout = 180_000;
const packageDirectory = path.resolve(import.meta.dir, "..");

/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const run = (command: string[], cwd: string): void => {
  const result = Bun.spawnSync({
    cmd: command,
    cwd,
    killSignal: "SIGKILL",
    stderr: "pipe",
    stdout: "pipe",
    timeout: smokeTimeout,
  });
  if (result.exitCode !== 0) {
    throw new Error(
      [
        `Command failed: ${command.join(" ")}`,
        result.stdout.toString(),
        result.stderr.toString(),
      ].join("\n")
    );
  }
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */

/* oxlint-disable eslint/max-statements -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable eslint/max-lines-per-function -- Keep the test setup, action, and assertions together so this scenario remains independently understandable. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-magic-numbers -- These values are concrete test inputs and expected results; naming each literal would make the fixture harder to compare with its assertions. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
test(
  "the packed package loads its core and React entry points",
  async (): Promise<void> => {
    const temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), "chatjs-thread-package-")
    );

    try {
      run(["bun", "run", "build"], packageDirectory);
      run(
        [
          "bun",
          "pm",
          "pack",
          "--filename",
          path.join(temporaryDirectory, "thread.tgz"),
          "--ignore-scripts",
          "--quiet",
        ],
        packageDirectory
      );

      const installedPackage = path.join(
        temporaryDirectory,
        "node_modules",
        "@chat-js",
        "thread"
      );
      await writeFile(
        path.join(temporaryDirectory, "package.json"),
        JSON.stringify({
          dependencies: {
            "@chat-js/thread": "file:./thread.tgz",
          },
          private: true,
          type: "module",
        })
      );
      // Unpack the actual distribution outside the workspace. Linking only the
      // lockfile-installed peers keeps this check independent of npm availability.
      await mkdir(installedPackage, { recursive: true });
      run(
        [
          "tar",
          "-xzf",
          path.join(temporaryDirectory, "thread.tgz"),
          "--strip-components=1",
          "-C",
          installedPackage,
        ],
        temporaryDirectory
      );
      const linkDependency = async (name: string): Promise<void> => {
        const destination = path.join(temporaryDirectory, "node_modules", name);
        await mkdir(path.dirname(destination), { recursive: true });
        await symlink(
          path.dirname(
            Bun.resolveSync(`${name}/package.json`, packageDirectory)
          ),
          destination,
          "dir"
        );
      };
      await linkDependency("ai");

      const coreConsumerPath = path.join(temporaryDirectory, "core.mjs");
      await writeFile(
        coreConsumerPath,
        `
import assert from "node:assert/strict";
import { Thread } from "@chat-js/thread";
assert.equal(import.meta.resolve("@chat-js/thread"), new URL("./node_modules/@chat-js/thread/dist/index.js", import.meta.url).href);
assert.equal(typeof new Thread().id, "string");
assert.throws(() => import.meta.resolve("react"), { code: "ERR_MODULE_NOT_FOUND" });
assert.throws(() => import.meta.resolve("@ai-sdk/react"), { code: "ERR_MODULE_NOT_FOUND" });
`
      );
      run(["node", coreConsumerPath], temporaryDirectory);
      await Promise.all(
        ["react", "@ai-sdk/react", "@types/react", "typescript"].map(
          (name): Promise<void> => linkDependency(name)
        )
      );

      const indexSource = await readFile(
        path.join(installedPackage, "dist/index.js"),
        "utf-8"
      );
      const reactSource = await readFile(
        path.join(installedPackage, "dist/react.js"),
        "utf-8"
      );

      const packageMetadata: unknown = await Bun.file(
        path.join(installedPackage, "package.json")
      ).json();
      const indexChunk = /from "(?<chunk>\.\/chunk-[^"]+\.js)"/u.exec(
        indexSource
      )?.groups?.chunk;
      const reactChunk = /from "(?<chunk>\.\/chunk-[^"]+\.js)"/u.exec(
        reactSource
      )?.groups?.chunk;

      if (
        typeof packageMetadata !== "object" ||
        !packageMetadata ||
        !("peerDependenciesMeta" in packageMetadata)
      ) {
        throw new Error(
          "Installed package must declare optional peer metadata"
        );
      }
      expect(packageMetadata.peerDependenciesMeta).toEqual({
        react: { optional: true },
      });
      expect(reactSource.startsWith('"use client";')).toBeTrue();
      expect(reactSource.match(/"use client";/gu)).toHaveLength(1);
      expect(indexChunk).toBeDefined();
      expect(reactChunk).toBe(indexChunk);
      expect(reactSource).not.toContain("class Thread");
      if (!(typeof reactChunk === "string" && reactChunk !== "")) {
        throw new Error("Expected a shared package chunk");
      }
      const coreChunkPath = path.resolve(installedPackage, "dist", reactChunk);
      expect(await Bun.file(coreChunkPath).exists()).toBeTrue();
      const coreChunkSource = await readFile(coreChunkPath, "utf-8");
      expect(indexSource).not.toContain('from "react"');
      expect(coreChunkSource).not.toContain('from "react"');
      expect(coreChunkSource).not.toContain('from "@ai-sdk/react"');

      const consumerSource = `
import { Thread } from "@chat-js/thread";
import { useThread } from "@chat-js/thread/react";

const chat = new Thread();
if (typeof chat.id !== "string" || typeof useThread !== "function") {
  throw new Error("Package exports did not load");
}
`;
      const resolutionConsumerPath = path.join(
        temporaryDirectory,
        "resolution.mjs"
      );
      await writeFile(
        resolutionConsumerPath,
        `
import assert from "node:assert/strict";
for (const [specifier, file] of [["@chat-js/thread", "index.js"], ["@chat-js/thread/react", "react.js"]]) {
  assert.equal(import.meta.resolve(specifier), new URL("./node_modules/@chat-js/thread/dist/" + file, import.meta.url).href);
}
`
      );
      run(["node", resolutionConsumerPath], temporaryDirectory);
      const runtimeConsumerPath = path.join(temporaryDirectory, "consumer.mjs");
      const typeConsumerPath = path.join(temporaryDirectory, "consumer.ts");
      await Promise.all([
        writeFile(runtimeConsumerPath, consumerSource),
        writeFile(
          typeConsumerPath,
          `${consumerSource}
import type { UIMessage } from "ai";
import { createThread } from "@chat-js/thread";
import type { ThreadInit } from "@chat-js/thread";

type LabeledMessage = UIMessage<{ threadLabel: string }>;
const labeledThread = new Thread<LabeledMessage>();
const createdThread = createThread<LabeledMessage>();
const threadLabel: string | undefined = labeledThread.getSnapshot().messages[0]?.metadata?.threadLabel;
const createdLabel: string | undefined = createdThread.getSnapshot().messages[0]?.metadata?.threadLabel;
// @ts-expect-error Thread metadata must retain its specialized shape.
labeledThread.getSnapshot().messages[0]?.metadata?.absentProperty;
// @ts-expect-error createThread metadata must retain its specialized shape.
createdThread.getSnapshot().messages[0]?.metadata?.absentProperty;

type UnsupportedMessage = LabeledMessage & {
  tenant: string;
  id: "custom-id";
  role: "user";
  parts: [{ type: "text"; text: string }];
};
declare const constructorFinishEvent: Parameters<NonNullable<ThreadInit<UnsupportedMessage>["onFinish"]>>[0];
// @ts-expect-error Constructor callbacks also receive canonical SDK messages.
constructorFinishEvent.message.tenant;
const [normalized] = new Thread<UnsupportedMessage>().getSnapshot().messages;
// @ts-expect-error The SDK cannot guarantee arbitrary required message fields.
normalized.tenant;
// @ts-expect-error Generated IDs keep the SDK string contract.
const unsupportedId: "custom-id" = normalized.id;
// @ts-expect-error Streaming also constructs assistant messages.
const unsupportedRole: "user" = normalized.role;
// @ts-expect-error Streaming cannot guarantee a fixed text-part tuple.
const unsupportedParts: [{ type: "text"; text: string }] = normalized.parts;

// This function is only type-checked, never passed to the runtime consumer.
function checkHookInference() {
  const helpers = useThread({ thread: labeledThread });
  const hookLabel: string | undefined = helpers.messages[0]?.metadata?.threadLabel;
  // @ts-expect-error useThread must infer the supplied thread's metadata shape.
  helpers.messages[0]?.metadata?.absentProperty;
  return hookLabel;
}
function checkNormalizedHook() {
  const helpers = useThread({ thread: new Thread<UnsupportedMessage>() });
  // @ts-expect-error Hook messages cannot reintroduce unsupported fields.
  helpers.messages[0]?.tenant;
}
`
        ),
      ]);

      run(["node", runtimeConsumerPath], temporaryDirectory);
      run(
        [
          "node",
          path.join(temporaryDirectory, "node_modules/typescript/bin/tsc"),
          "--ignoreConfig",
          "--noEmit",
          "--strict",
          "--skipLibCheck",
          "--target",
          "ES2022",
          "--module",
          "ESNext",
          "--moduleResolution",
          "Bundler",
          typeConsumerPath,
        ],
        temporaryDirectory
      );
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  },
  smokeTimeout
);
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/max-lines-per-function */
/* oxlint-enable eslint/max-statements */
