import { expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const packageDirectory = resolve(import.meta.dir, "..");

function run(command: string[], cwd: string) {
	const result = Bun.spawnSync({
		cmd: command,
		cwd,
		killSignal: "SIGKILL",
		stderr: "pipe",
		stdout: "pipe",
		timeout: 25_000,
	});
	if (result.exitCode !== 0) {
		throw new Error(
			[
				`Command failed: ${command.join(" ")}`,
				result.stdout.toString(),
				result.stderr.toString(),
			].join("\n"),
		);
	}
}

test("the packed package loads its core and React entry points", async () => {
	const temporaryDirectory = await mkdtemp(
		join(packageDirectory, ".package-smoke-"),
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
			packageDirectory,
		);

		const installedPackage = join(
			temporaryDirectory,
			"node_modules",
			"@chatjs",
			"thread",
		);
		await mkdir(installedPackage, { recursive: true });
		run(
			[
				"tar",
				"-xzf",
				join(temporaryDirectory, "thread.tgz"),
				"-C",
				installedPackage,
				"--strip-components=1",
			],
			packageDirectory,
		);

		const indexSource = await readFile(
			join(installedPackage, "dist/index.js"),
			"utf8",
		);
		const reactSource = await readFile(
			join(installedPackage, "dist/react.js"),
			"utf8",
		);
		const packageMetadata = await Bun.file(
			join(installedPackage, "package.json"),
		).json();
		const indexChunk = indexSource.match(/from "(\.\/chunk-[^"]+\.js)"/)?.[1];
		const reactChunk = reactSource.match(/from "(\.\/chunk-[^"]+\.js)"/)?.[1];

		expect(packageMetadata.peerDependenciesMeta).toEqual({
			"@ai-sdk/react": { optional: true },
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
import { Thread } from "@chatjs/thread";
import { useThread } from "@chatjs/thread/react";

const chat = new Thread();
if (typeof chat.id !== "string" || typeof useThread !== "function") {
  throw new Error("Package exports did not load");
}
`;
		const runtimeConsumerPath = join(temporaryDirectory, "consumer.mjs");
		const typeConsumerPath = join(temporaryDirectory, "consumer.ts");
		await Promise.all([
			writeFile(runtimeConsumerPath, consumerSource),
			writeFile(typeConsumerPath, consumerSource),
		]);

		run(["node", runtimeConsumerPath], temporaryDirectory);
		run(
			[
				join(packageDirectory, "node_modules/.bin/tsc"),
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
			temporaryDirectory,
		);
	} finally {
		await rm(temporaryDirectory, { force: true, recursive: true });
	}
}, 30_000);
