import { spawn } from "node:child_process";
import path from "node:path";

// Bun/dotenv/worktree wrappers may exit before an async signal handler drains.
// Keep the transaction owner outside their foreground process group. IPC loss
// also requests shutdown if a wrapper exits without forwarding a signal.
const watcher = spawn(
  process.execPath,
  [path.join(import.meta.dir, "demo-watch.ts")],
  {
    detached: true,
    stdio: ["inherit", "inherit", "inherit", "ipc"],
  }
);
const shutdown = (): void => {
  watcher.kill("SIGTERM");
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
const closed = Promise.withResolvers<number>();
watcher.once("error", (error) => {
  console.error(error.message);
  closed.resolve(1);
});
watcher.once("close", (code) => {
  closed.resolve(code ?? 1);
});
process.exitCode = await closed.promise;
process.removeListener("SIGINT", shutdown);
process.removeListener("SIGTERM", shutdown);
