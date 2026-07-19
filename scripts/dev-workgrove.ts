import { join } from "node:path";

type ChildName = "chat" | "electron" | "site";
type AppGroup = "chat" | "site";

interface ChildSpec {
	argv: string[];
	cwd: string;
	env: Record<string, string>;
	name: ChildName;
}

function requiredEnvironment(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Workgrove did not provide ${name}`);
	}
	return value;
}

const repositoryRoot = join(import.meta.dir, "..");
const appGroup = (Bun.argv[2] ?? "chat") as AppGroup;

if (appGroup !== "chat" && appGroup !== "site") {
	throw new Error(`Unknown Workgrove app group: ${appGroup}`);
}

const specs: ChildSpec[] =
	appGroup === "chat"
		? [
				{
					argv: ["bun", "run", "dev"],
					cwd: "apps/chat",
					env: {
						APP_URL: requiredEnvironment("CHAT_URL"),
						PORT: requiredEnvironment("CHAT_PORT"),
					},
					name: "chat",
				},
				{
					argv: ["bun", "run", "dev"],
					cwd: "apps/electron",
					env: { ELECTRON_APP_URL: requiredEnvironment("CHAT_URL") },
					name: "electron",
				},
			]
		: [
				{
					argv: [
						"bunx",
						"--bun",
						"next",
						"dev",
						"--port",
						requiredEnvironment("SITE_PORT"),
					],
					cwd: "apps/site",
					env: { PORT: requiredEnvironment("SITE_PORT") },
					name: "site",
				},
			];

const children = specs.map((spec) => ({
	...spec,
	process: Bun.spawn(spec.argv, {
		cwd: join(repositoryRoot, spec.cwd),
		env: { ...process.env, ...spec.env },
		stdin: "inherit",
		stdout: "inherit",
		stderr: "inherit",
	}),
}));

let stopping = false;

async function stop(signal: NodeJS.Signals, exitCode: number): Promise<never> {
	if (!stopping) {
		stopping = true;
		for (const child of children) {
			child.process.kill(signal);
		}
	}
	await Promise.allSettled(children.map((child) => child.process.exited));
	process.exit(exitCode);
}

process.once("SIGINT", () => {
	void stop("SIGINT", 0);
});
process.once("SIGTERM", () => {
	void stop("SIGTERM", 0);
});

const firstExit = await Promise.race(
	children.map(async (child) => ({
		code: await child.process.exited,
		name: child.name,
	}))
);

if (!stopping) {
	console.error(
		`${firstExit.name} exited unexpectedly with code ${firstExit.code}`
	);
	await stop("SIGTERM", firstExit.code === 0 ? 1 : firstExit.code);
}
