import { afterAll, beforeAll, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../../../..");
const turbo = join(repoRoot, "node_modules/.bin/turbo");
let fixture: string;

function run(command: string[]) {
	return Bun.spawnSync(command, {
		cwd: fixture,
		env: {
			...process.env,
			TURBO_SCM_BASE: "",
			TURBO_SCM_HEAD: "",
		},
	});
}

function git(...args: string[]) {
	const result = run(["git", ...args]);
	if (result.exitCode !== 0) {
		throw new Error(result.stderr.toString());
	}
	return result.stdout.toString().trim();
}

beforeAll(async () => {
	fixture = await mkdtemp(join(tmpdir(), "chatjs-turbo-affected-"));
	// Use the real task graph, workspace manifests, and lockfile without
	// installing dependencies or copying generated artifacts into the fixture.
	for (const path of [
		"turbo.json",
		"bun.lock",
		"package.json",
		...[
			"apps/chat",
			"apps/docs",
			"apps/site",
			"apps/electron",
			"packages/cli",
			"packages/thread",
			"packages/registry",
			"packages/gateways",
		].map((workspace) => `${workspace}/package.json`),
	]) {
		await mkdir(dirname(join(fixture, path)), { recursive: true });
		await writeFile(join(fixture, path), await readFile(join(repoRoot, path)));
	}
	git("init", "-b", "main");
	git("config", "user.name", "Turbo CI test");
	git("config", "user.email", "turbo-test@example.invalid");
	git("add", ".");
	git("commit", "-m", "Fixture baseline");
});

afterAll(async () => {
	if (fixture) await rm(fixture, { recursive: true, force: true });
});

test.each([
	["apps/docs/index.mdx", false],
	["apps/site/app/page.tsx", false],
	["README.md", false],
	["apps/chat/.next/generated.js", false],
	["apps/chat/node_modules/example/index.js", false],
	["apps/chat/.env.local", false],
	["apps/electron/dist/main.js", false],
	["apps/electron/branding.json", false],
	["packages/cli/src/index.ts", true],
	["packages/registry/registry.ts", true],
	["packages/registry/metadata.ts", true],
	["packages/registry/src/tools/word-count/tool.ts", true],
	["packages/registry/src/gateways/vercel/gateway.ts", true],
	["packages/cli/scripts/test-scaffold.sh", true],
	["apps/chat/app/page.tsx", true],
	["apps/chat/package.json", true],
	["apps/electron/forge.config.ts", true],
	["apps/electron/package.json", true],
	["packages/thread/src/index.ts", true],
	["scripts/sync-template.ts", true],
	[".github/workflows/cli-scaffold.yml", true],
	["package.json", true],
	["bun.lock", true],
	["turbo.json", true],
])("scaffold affected detection for %s", async (path, affected) => {
	const base = git("rev-parse", "HEAD");
	const target = join(fixture, path);
	await mkdir(dirname(target), { recursive: true });
	const previous = await readFile(target, "utf8").catch(() => "");
	await writeFile(target, `${previous}\n`);
	git("add", path);
	git("commit", "-m", `Change ${path}`);

	const result = run([
		turbo,
		"query",
		"affected",
		"--tasks",
		"test:scaffold",
		"--packages",
		"@chat-js/cli",
		"--base",
		base,
		"--head",
		"HEAD",
		"--exit-code",
	]);
	expect(result.exitCode, result.stderr.toString()).toBe(affected ? 1 : 0);
	const output = JSON.parse(result.stdout.toString());
	const taskNames = output.data.affectedTasks.items.map(
		(task: { fullName: string }) => task.fullName,
	);
	expect(taskNames.includes("@chat-js/cli#test:scaffold")).toBe(affected);

	// CI's execution phase must agree with the pre-install query, including
	// inputs outside the CLI package that package-level --affected would miss.
	const execution = Bun.spawnSync(
		[turbo, "run", "test:scaffold", "test:unit", "--affected", "--dry=json"],
		{
			cwd: fixture,
			env: { ...process.env, TURBO_SCM_BASE: base, TURBO_SCM_HEAD: "HEAD" },
		},
	);
	expect(execution.exitCode, execution.stderr.toString()).toBe(0);
	const plannedTasks = JSON.parse(execution.stdout.toString()).tasks.map(
		(task: { taskId: string }) => task.taskId,
	);
	expect(plannedTasks.includes("@chat-js/cli#test:scaffold")).toBe(affected);
	if (
		path.startsWith("apps/chat/") ||
		path.startsWith("apps/site/") ||
		path.startsWith("apps/docs/") ||
		path.startsWith("apps/electron/") ||
		path.startsWith("packages/thread/src/") ||
		path.startsWith("packages/registry/src/") ||
		path === "scripts/sync-template.ts" ||
		path === "package.json"
	) {
		expect(plannedTasks.includes("@chat-js/cli#test:unit")).toBe(affected);
	}
});
