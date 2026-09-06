import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { join, resolve } from "node:path";

// Run with an authorized credential in the environment. No key is copied into
// checked-in examples, selection JSON, logs or evidence.
const repo = resolve(import.meta.dir, "../..");
assert(
	process.env.AUTHOR_APP,
	"Set AUTHOR_APP to the generated studio directory",
);
const app = resolve(process.env.AUTHOR_APP);
const key = process.env.OPENAI_API_KEY;
assert(key, "Provide an authorized OPENAI_API_KEY through the environment");
const node = process.env.AUTHOR_NODE ?? "/opt/homebrew/opt/node@24/bin/node";
const pg = process.env.PG_BIN ?? "/opt/homebrew/opt/postgresql@17/bin";
async function run(args: string[], cwd = app) {
	const child = Bun.spawn(args, {
		cwd,
		env: { ...process.env, ...env },
		stdout: "pipe",
		stderr: "pipe",
	});
	const [code, out, err] = await Promise.all([
		child.exited,
		new Response(child.stdout).text(),
		new Response(child.stderr).text(),
	]);
	assert.equal(code, 0, `${args[0]} ${args[1] ?? ""}: ${out}\n${err}`);
	return out;
}
const infoProc = Bun.spawn(["bun", "dev:info", "--json"], {
	cwd: repo,
	stdout: "pipe",
	stderr: "ignore",
});
const info = JSON.parse(await new Response(infoProc.stdout).text());
assert.equal(await infoProc.exited, 0);
const env: Record<string, string> = {
	...info.apps.minimal.env,
	EVE_GATEWAY_SECRET: crypto.randomUUID(),
	APP_IDENTITY_SECRET: crypto.randomUUID(),
	AUTHOR_GATEWAY_KEY: key,
	AUTHOR_GATEWAY_URL: "https://api.openai.com/v1",
	WORKFLOW_TARGET_WORLD: "@workflow/world-postgres",
};
const reserve = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	fetch: () => new Response("reserved"),
});
const pgPort = reserve.port;
reserve.stop(true);
const requests: unknown[] = [];
const search = Bun.serve({
	hostname: "127.0.0.1",
	port: 0,
	async fetch(request) {
		if (
			request.method !== "POST" ||
			request.headers.get("authorization") !== `Bearer ${env.AUTHOR_SEARCH_KEY}`
		)
			return new Response("denied", { status: 403 });
		requests.push(await request.json());
		await Bun.write(
			join(app, "evidence/search-requests.json"),
			JSON.stringify(requests, null, 2),
		);
		return Response.json({
			results: [
				{
					title: "SVG reference fixture",
					url: "https://developer.mozilla.org/en-US/docs/Web/SVG",
					snippet:
						"A deterministic local search result used to verify the author tool transport.",
				},
			],
		});
	},
});
env.AUTHOR_SEARCH_ENDPOINT = `http://127.0.0.1:${search.port}`;
env.AUTHOR_SEARCH_KEY = crypto.randomUUID();
env.PGUSER = userInfo().username;
env.PGPASSWORD = "";
env.APP_DATABASE_URL = `postgres://${encodeURIComponent(env.PGUSER)}@127.0.0.1:${pgPort}/author_examples`;
env.WORKFLOW_POSTGRES_URL = env.APP_DATABASE_URL;
const socket = await mkdtemp("/tmp/chatjs-author-pg-");
const data = join(app, ".postgres/data");
await mkdir(data, { recursive: true });
await mkdir(join(app, "evidence"), { recursive: true });
await writeFile(
	join(app, ".env.local"),
	`${Object.entries(env)
		.map(([name, value]) => `${name}=${JSON.stringify(value)}`)
		.join("\n")}\n`,
	{ mode: 0o600 },
);
await chmod(join(app, ".env.local"), 0o600);
if (!(await Bun.file(join(data, "PG_VERSION")).exists()))
	await run([
		join(pg, "initdb"),
		"--auth=trust",
		"--encoding=UTF8",
		"--no-locale",
		"-D",
		data,
	]);
await run([
	join(pg, "pg_ctl"),
	"-D",
	data,
	"-l",
	join(app, ".postgres/log"),
	"-o",
	`-h 127.0.0.1 -p ${pgPort} -k ${socket}`,
	"start",
]);
const services: ReturnType<typeof Bun.spawn>[] = [];
let stopping = false;
async function stop(code = 0) {
	if (stopping) return;
	stopping = true;
	for (const process of services) process.kill("SIGTERM");
	search.stop(true);
	await run([join(pg, "pg_ctl"), "-D", data, "-m", "fast", "stop"]);
	process.exit(code);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
try {
	await run([
		join(pg, "createdb"),
		"-h",
		"127.0.0.1",
		"-p",
		String(pgPort),
		"author_examples",
	]);
	await run(["bun", "run", "db:init"]);
	await run([node, "node_modules/@workflow/world-postgres/bin/setup.js"]);
	await run([node, "node_modules/eve/bin/eve.js", "build"]);
	for (const [name, args, serviceEnv] of [
		[
			"eve",
			[
				node,
				"node_modules/eve/bin/eve.js",
				"start",
				"--host",
				"127.0.0.1",
				"--port",
				String(info.apps.minimalEve.port),
			],
			env,
		],
		[
			"next",
			[
				"bun",
				"run",
				"worktree-env",
				"minimal",
				"--",
				node,
				join(app, "node_modules/next/dist/bin/next"),
				"dev",
				app,
			],
			{ ...env, CHATJS_DEV_SLOT: String(info.slot) },
		],
	] as const) {
		const log = Bun.file(join(app, `evidence/${name}.log`));
		services.push(
			Bun.spawn([...args], {
				cwd: name === "next" ? repo : app,
				env: { ...process.env, ...serviceEnv },
				stdout: log,
				stderr: log,
			}),
		);
	}
	// Host-issued fixture cookie, using the exact installed identity contract.
	await Bun.write(
		join(app, "issue-cookie.ts"),
		`import {SignJWT} from 'jose';\nconst token=await new SignJWT({}).setProtectedHeader({alg:'HS256'}).setIssuer('chatjs-host').setAudience('chatjs-minimal').setSubject('author-browser').setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(process.env.APP_IDENTITY_SECRET!));\nawait Bun.write('evidence/identity.cookies', 'curl '+process.env.APP_ORIGIN+" -H 'Cookie: chatjs_identity="+token+"'\\n");\n`,
	);
	await run(["bun", "issue-cookie.ts"]);
	await chmod(join(app, "evidence/identity.cookies"), 0o600);
	await Bun.write(
		join(app, "evidence/live-context.json"),
		JSON.stringify(
			{
				appOrigin: env.APP_ORIGIN,
				eveOrigin: env.EVE_INTERNAL_ORIGIN,
				model: "gpt-5-mini",
				search: "deterministic local HTTP fixture",
				pgPort,
			},
			null,
			2,
		),
	);
	console.log(
		`Live example starting at ${env.APP_ORIGIN}; private worker ${env.EVE_INTERNAL_ORIGIN}. Cookie fixture written without displaying token. Ctrl-C stops owned services/database.`,
	);
	await new Promise(() => {});
} catch (error) {
	console.error(error);
	await stop(1);
}
