import { expect, test } from "bun:test";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { tmpdir } from "node:os";

const waitForFile = async (file: string): Promise<void> => {
  const deadline = Date.now() + 5000;
  // oxlint-disable-next-line no-await-in-loop -- Each condition observes a later process state.
  while (!(await Bun.file(file).exists())) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out: ${file}`);
    }
    // oxlint-disable-next-line no-await-in-loop -- Observe the detached child's completion marker without imposing a fixed test sleep.
    await delay(10);
  }
};

test("terminal shutdown through bun run lets the detached transaction owner drain", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "demo-process-test-"));
  let watcherPid: number | undefined;
  let launcher: ReturnType<typeof spawn> | undefined;
  try {
    await cp(
      path.resolve(import.meta.dir, "../scripts/demo-dev.ts"),
      path.join(directory, "demo-dev.ts")
    );
    await writeFile(
      path.join(directory, "package.json"),
      JSON.stringify({ scripts: { dev: "bun demo-dev.ts" } })
    );
    await writeFile(
      path.join(directory, "demo-watch.ts"),
      `
import { writeFile, unlink } from "node:fs/promises";
const stop = Promise.withResolvers();
process.on("SIGTERM", () => stop.resolve());
process.on("disconnect", () => stop.resolve());
await writeFile("writer.lock", String(process.pid));
await stop.promise;
await Bun.sleep(150);
await unlink("writer.lock");
await writeFile("drained", "yes");
if (process.connected) process.disconnect();
`
    );
    launcher = spawn(process.execPath, ["run", "dev"], {
      cwd: directory,
      detached: true,
      stdio: "ignore",
    });
    const closed = Promise.withResolvers<boolean>();
    launcher.once("close", () => {
      closed.resolve(true);
    });
    await waitForFile(path.join(directory, "writer.lock"));
    watcherPid = Number(
      await readFile(path.join(directory, "writer.lock"), "utf-8")
    );
    if (launcher.pid === undefined) {
      throw new Error("No launcher PID");
    }
    process.kill(-launcher.pid, "SIGINT");
    await closed.promise;
    await waitForFile(path.join(directory, "drained"));
    expect(await Bun.file(path.join(directory, "writer.lock")).exists()).toBe(
      false
    );
  } finally {
    for (const pid of [watcherPid, launcher?.pid]) {
      if (pid !== undefined) {
        try {
          process.kill(pid, "SIGKILL");
        } catch {
          /* Already exited. */
        }
      }
    }
    await rm(directory, { recursive: true, force: true });
  }
});
