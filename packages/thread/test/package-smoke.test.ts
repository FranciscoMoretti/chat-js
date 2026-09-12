import { expect, test } from "bun:test";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const smokeTimeout = 180_000;
const packageDirectory = resolve(import.meta.dir, "..");

function run(command: string[], cwd: string) {
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
}

test(
  "the packed package loads its core and React entry points",
  async () => {
    const temporaryDirectory = await mkdtemp(
      join(tmpdir(), "chatjs-thread-package-")
    );

    try {
      run(["bun", "run", "build"], packageDirectory);
      run(
        [
          "bun",
          "pm",
          "pack",
          "--filename",
          join(temporaryDirectory, "thread.tgz"),
          "--ignore-scripts",
          "--quiet",
        ],
        packageDirectory
      );

      const installedPackage = join(
        temporaryDirectory,
        "node_modules",
        "@chat-js",
        "thread"
      );
      await writeFile(
        join(temporaryDirectory, "package.json"),
        JSON.stringify({
          private: true,
          type: "module",
          dependencies: {
            "@chat-js/thread": "file:./thread.tgz",
          },
        })
      );
      // Unpack the actual distribution outside the workspace. Linking only the
      // lockfile-installed peers keeps this check independent of npm availability.
      await mkdir(installedPackage, { recursive: true });
      run(
        [
          "tar",
          "-xzf",
          join(temporaryDirectory, "thread.tgz"),
          "--strip-components=1",
          "-C",
          installedPackage,
        ],
        temporaryDirectory
      );
      async function linkDependency(name: string) {
        const destination = join(temporaryDirectory, "node_modules", name);
        await mkdir(dirname(destination), { recursive: true });
        await symlink(
          dirname(Bun.resolveSync(`${name}/package.json`, packageDirectory)),
          destination,
          "dir"
        );
      }
      await linkDependency("ai");

      const coreConsumerPath = join(temporaryDirectory, "core.mjs");
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
          linkDependency
        )
      );

      const indexSource = await readFile(
        join(installedPackage, "dist/index.js"),
        "utf8"
      );
      const reactSource = await readFile(
        join(installedPackage, "dist/react.js"),
        "utf8"
      );
      const packageMetadata = await Bun.file(
        join(installedPackage, "package.json")
      ).json();
      const indexChunk = indexSource.match(/from "(\.\/chunk-[^"]+\.js)"/)?.[1];
      const reactChunk = reactSource.match(/from "(\.\/chunk-[^"]+\.js)"/)?.[1];

      expect(packageMetadata.peerDependenciesMeta).toEqual({
        react: { optional: true },
      });
      expect(reactSource.startsWith('"use client";')).toBeTrue();
      expect(reactSource.match(/"use client";/g)).toHaveLength(1);
      expect(indexChunk).toBeDefined();
      expect(reactChunk).toBe(indexChunk);
      expect(reactSource).not.toContain("class Thread");
      if (!reactChunk) throw new Error("Expected a shared package chunk");
      const coreChunkPath = resolve(installedPackage, "dist", reactChunk);
      expect(await Bun.file(coreChunkPath).exists()).toBeTrue();
      const coreChunkSource = await readFile(coreChunkPath, "utf8");
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
      const resolutionConsumerPath = join(temporaryDirectory, "resolution.mjs");
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
      const runtimeConsumerPath = join(temporaryDirectory, "consumer.mjs");
      const typeConsumerPath = join(temporaryDirectory, "consumer.ts");
      await Promise.all([
        writeFile(runtimeConsumerPath, consumerSource),
        writeFile(typeConsumerPath, consumerSource),
      ]);

      run(["node", runtimeConsumerPath], temporaryDirectory);
      run(
        [
          "node",
          join(temporaryDirectory, "node_modules/typescript/bin/tsc"),
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
