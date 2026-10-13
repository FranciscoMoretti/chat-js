import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { open, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { z } from "zod";

import { createRuntimeFixture } from "./fixture";

const pollIntervalMs = 100;
const startupTimeoutMs = 60_000;
const zero = 0;
const one = 1;
const healthTimeoutMs = 1000;

/** Poll external runtime evidence with a bounded deadline; never resend a command. */
const until = async <TValue>(
  probe: () => Promise<TValue | undefined> | TValue | undefined,
  timeoutMs = startupTimeoutMs
): Promise<TValue> => {
  const deadline = Date.now() + timeoutMs;
  // Runtime probes and their delay must finish before checking the next deadline.
  /* oxlint-disable no-await-in-loop */
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined) {
      return value;
    }
    await Bun.sleep(pollIntervalMs);
  }
  /* oxlint-enable no-await-in-loop */
  throw new Error(`Runtime evidence timeout after ${timeoutMs}ms`);
};
const createPersistentRuntime = async (
  source: string,
  experimentalInstallation?: {
    readonly distribution?: "production-fork";
    readonly nodeModules: string;
    readonly provenance: string;
  },
  recovery: {
    readonly inlineOwnershipLeaseSeconds?: number;
    readonly world?: "local" | "postgres";
  } = {}
) => {
  const fixture = await createRuntimeFixture(source, experimentalInstallation);
  const maximumLeaseSeconds = 900;
  const inlineOwnershipLeaseSeconds = z
    .number()
    .int()
    .min(one)
    .max(maximumLeaseSeconds)
    .optional()
    .parse(recovery.inlineOwnershipLeaseSeconds);
  const environment = {
    ...fixture.environment,
    ...(inlineOwnershipLeaseSeconds === undefined
      ? {}
      : {
          WORKFLOW_INLINE_OWNERSHIP_LEASE_SECONDS: String(
            inlineOwnershipLeaseSeconds
          ),
        }),
  };
  await writeFile(
    path.join(fixture.directory, "recovery-policy.json"),
    JSON.stringify({
      inlineOwnershipLeaseSeconds:
        inlineOwnershipLeaseSeconds ?? "runtime-default-860",
      world: recovery.world ?? "local",
    })
  );
  const reservation = Bun.serve({
    fetch: () => new Response("reserved"),
    hostname: "127.0.0.1",
    port: zero,
  });
  const { port } = reservation;
  await reservation.stop(true);
  const url = `http://127.0.0.1:${port}`;
  const state: {
    running?: { child: ChildProcess; pid: number; exited: Promise<unknown> };
  } = {};
  let generation = zero;

  const crash = async (serverPid?: number): Promise<void> => {
    if (state.running === undefined) {
      return;
    }
    const crashEvidence = async (phase: string): Promise<void> => {
      await writeFile(
        path.join(fixture.directory, `crash-${generation}.json`),
        JSON.stringify({ phase, serverPid })
      );
    };
    await crashEvidence("checking-parent");
    if (serverPid !== undefined) {
      z.number().int().positive().parse(serverPid);
      const parent = Bun.spawn(["ps", "-p", String(serverPid), "-o", "ppid="], {
        stdout: "pipe",
      });
      const parentText = await new Response(parent.stdout).text();
      const parentPid = Number(parentText.trim());
      if ((await parent.exited) !== zero || parentPid !== state.running.pid) {
        throw new Error(
          "Refusing to kill a server outside this fixture's CLI process"
        );
      }
      process.kill(-serverPid, "SIGKILL");
      await crashEvidence("server-signaled");
    }
    if (serverPid !== undefined) {
      await until(async () => {
        // On macOS, kill(group, 0) can return EPERM while a killed child is reaped.
        // Read process-group membership instead; never treat a permission error as death.
        const groups = Bun.spawn(["ps", "-axo", "pgid="], { stdout: "pipe" });
        const groupText = await new Response(groups.stdout).text();
        if ((await groups.exited) !== zero) {
          throw new Error("Unable to verify terminated server process group");
        }
        return groupText
          .split(/\s+/u)
          .some((value) => Number(value) === serverPid)
          ? undefined
          : true;
      });
      await crashEvidence("server-group-terminated");
      // Only the dead server's stale URL record is removed; durable data is retained.
      await rm(path.join(fixture.directory, ".eve/dev-server-state.v1.json"), {
        force: true,
      });
      await crashEvidence("stale-url-removed");
    }
    if (
      state.running.child.exitCode === null &&
      state.running.child.signalCode === null
    ) {
      try {
        process.kill(-state.running.pid, "SIGKILL");
      } catch (error) {
        // The CLI may exit itself when its directly killed server disconnects.
        if (
          !(error instanceof Error && "code" in error && error.code === "ESRCH")
        ) {
          throw error;
        }
      }
    }
    const stopped = state.running;
    await until(() =>
      stopped.child.exitCode !== null || stopped.child.signalCode !== null
        ? true
        : undefined
    );
    await stopped.exited;
    await crashEvidence("cli-exited");
    // EVE's detached server closes asynchronously on CLI IPC disconnect.
    // Do not release barriers or reuse its port while that owner can still run.
    await until(async () =>
      (await Bun.file(
        path.join(fixture.directory, ".eve/dev-server-state.v1.json")
      ).exists())
        ? undefined
        : true
    );
    delete state.running;
  };

  const start = async (): Promise<void> => {
    if (state.running !== undefined) {
      throw new Error("Stop the current runtime before restarting it.");
    }
    generation += one;
    const log = await open(
      path.join(fixture.directory, `worker-${generation}.log`),
      "a"
    );
    const child = spawn(
      fixture.node,
      [
        fixture.cli,
        "dev",
        "--no-ui",
        ...(experimentalInstallation?.distribution === "production-fork"
          ? []
          : ["--no-default-extensions"]),
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        ...(recovery.world === "postgres" ? [] : ["--resume"]),
      ],
      {
        cwd: fixture.directory,
        detached: true,
        env: environment,
        stdio: ["ignore", log.fd, log.fd],
      }
    );
    const exited = once(child, "exit");
    await log.close();
    if (child.pid === undefined) {
      throw new Error("Failed to start the native worker");
    }
    state.running = { child, exited, pid: child.pid };
    await until(async () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        throw new Error(
          `Worker exited; inspect ${fixture.directory}/worker-${generation}.log`
        );
      }
      let ready = false;
      try {
        const response = await fetch(`${url}/eve/v1/health`, {
          signal: AbortSignal.timeout(healthTimeoutMs),
        });
        ready = response.ok;
      } catch {
        ready = false;
      }
      return ready ? true : undefined;
    });
  };

  return {
    crash,
    directory: fixture.directory,
    node: fixture.node,
    release: async (name: string): Promise<void> => {
      await writeFile(
        path.join(fixture.directory, `${name}.release`),
        "released"
      );
    },
    remove: async (): Promise<void> => {
      await crash();
      await rm(fixture.directory, { force: true, recursive: true });
    },
    start,
    url,
    waitForMarker: async (
      name: string,
      timeoutMs = startupTimeoutMs
    ): Promise<unknown> =>
      await until(async () => {
        const file = Bun.file(path.join(fixture.directory, `${name}.json`));
        const value: unknown = (await file.exists())
          ? await file.json()
          : undefined;
        return value;
      }, timeoutMs),
  };
};
export { createPersistentRuntime, until };
