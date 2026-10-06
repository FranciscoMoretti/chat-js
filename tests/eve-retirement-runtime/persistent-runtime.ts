/* oxlint-disable no-undefined -- Undefined means a pending probe or absent worker; null would be a distinct JSON marker value. */
/* oxlint-disable import/no-nodejs-modules -- The native test controller owns child process groups, log descriptors and disposable storage. */
import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { once } from "node:events";
import { open, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/* oxlint-enable import/no-nodejs-modules */
import { createRuntimeFixture } from "./fixture";

const pollIntervalMs = 100;
const startupTimeoutMs = 60_000;
const zero = 0;
const one = 1;
const healthTimeoutMs = 1000;

/** Poll external runtime evidence with a bounded deadline; never resend a command. */
/* oxlint-disable jsdoc/require-param, jsdoc/require-returns -- The function signature supplies the probe and timeout contract. */
const until = async <TValue>(
  probe: () => Promise<TValue | undefined>,
  timeoutMs = startupTimeoutMs
): Promise<TValue> => {
  const deadline = Date.now() + timeoutMs;
  /* oxlint-disable eslint/no-await-in-loop -- Each evidence read completes before the next bounded poll. */
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined) {
      return value;
    }
    await Bun.sleep(pollIntervalMs);
  }
  /* oxlint-enable eslint/no-await-in-loop */
  throw new Error(`Runtime evidence timeout after ${timeoutMs}ms`);
};
/* oxlint-enable jsdoc/require-param, jsdoc/require-returns */

/* oxlint-disable max-statements, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- This test fixture owns a process and its storage for the full restart scenario; the returned methods expose the concrete lifecycle. */
const createPersistentRuntime = async (
  source: string,
  experimentalInstallation?: {
    readonly nodeModules: string;
    readonly provenance: string;
  }
) => {
  const fixture = await createRuntimeFixture(source, experimentalInstallation);
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

  const crash = async (): Promise<void> => {
    if (state.running === undefined) {
      return;
    }
    if (
      state.running.child.exitCode === null &&
      state.running.child.signalCode === null
    ) {
      process.kill(-state.running.pid, "SIGKILL");
    }
    await state.running.exited;
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
        "--no-default-extensions",
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--resume",
      ],
      {
        cwd: fixture.directory,
        detached: true,
        env: fixture.environment,
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
/* oxlint-enable max-statements, max-lines-per-function, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

export { createPersistentRuntime, until };
/* oxlint-enable no-undefined */
