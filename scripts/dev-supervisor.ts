import { execFileSync, spawn } from "node:child_process";
import { checkHealth } from "./dev-health";
import { shouldRestartAfterReadinessFailures } from "./dev-recovery";

const origin = process.env.APP_URL;
if (!origin || !["localhost", "127.0.0.1"].includes(new URL(origin).hostname)) {
	throw new Error("Run through bun dev:supervise with a local worktree URL.");
}

let stopping = false;
let child: ReturnType<typeof spawn> | undefined;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Eve's development runtime detaches its child process. Track descendants
// while the launcher is alive so shutdown also cleans up detached workers.
let descendants = new Map<number, string>();
function trackChildren() {
	if (!child?.pid) return;
	const rows = execFileSync("ps", ["-axo", "pid=,ppid=,lstart="], {
		encoding: "utf8",
	})
		.trim()
		.split("\n")
		.map((line) => {
			const [pid, parent, ...started] = line.trim().split(/\s+/);
			return {
				pid: Number(pid),
				parent: Number(parent),
				started: started.join(" "),
			};
		});
	const alive = new Map(rows.map((row) => [row.pid, row.started]));
	for (const [pid, started] of descendants) {
		if (alive.get(pid) !== started) descendants.delete(pid);
	}
	const found = new Set([child.pid]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const { pid, parent } of rows) {
			if (pid && parent && found.has(parent) && !found.has(pid)) {
				found.add(pid);
				changed = true;
			}
		}
	}
	for (const pid of found) {
		const started = alive.get(pid);
		if (started) descendants.set(pid, started);
	}
}
function terminate(signal: NodeJS.Signals) {
	trackChildren();
	for (const pid of descendants.keys()) {
		try {
			process.kill(pid, signal);
		} catch {
			/* Already exited. */
		}
	}
}
const signals: NodeJS.Signals[] = ["SIGTERM", "SIGINT"];
for (const signal of signals) {
	process.on(signal, () => {
		stopping = true;
		terminate("SIGTERM");
	});
}
let backoff = 5000;
let failedStartups = 0;
while (!stopping) {
	console.info("Starting ChatJS and managed Eve runtime");
	child = spawn(process.execPath, ["run", "dev"], {
		detached: true,
		stdio: "inherit",
		env: { ...process.env, NODE_OPTIONS: "--max-old-space-size=4096" },
	});
	let exited = false;
	child.once("exit", () => {
		exited = true;
	});
	child.once("error", () => {
		exited = true;
	});
	const started = Date.now();
	let failures = 0;
	let wasReady = false;
	let lastReadyAt = started;
	while (!stopping && !exited) {
		trackChildren();
		try {
			await checkHealth(origin);
			if (!wasReady) console.info("ChatJS, Eve and database are ready");
			wasReady = true;
			failedStartups = 0;
			lastReadyAt = Date.now();
			failures = 0;
			backoff = 5000;
		} catch {
			failures++;
			if (
				shouldRestartAfterReadinessFailures(
					failures,
					Date.now() - lastReadyAt,
					wasReady,
					failedStartups,
				)
			) {
				console.error(
					"Readiness remained unavailable through the recovery grace period; restarting the local runtime",
				);
				break;
			}
		}
		await sleep(10_000);
	}
	if (!wasReady) failedStartups++;
	terminate("SIGTERM");
	await sleep(2000);
	terminate("SIGKILL");
	child = undefined;
	descendants = new Map();
	if (!stopping) {
		console.info(`Restarting in ${backoff / 1000}s`);
		await sleep(backoff);
		backoff = Math.min(backoff * 2, 60_000);
	}
}
