import { spawn } from "node:child_process";
import path from "node:path";
import { createDemoMirror } from "./demo-mirror";
import { trackDemoProcesses } from "./demo-processes";

const root = path.resolve(import.meta.dir, "../../..");
const shutdown = new AbortController();
const signalShutdown = (): void => {
  shutdown.abort();
};
process.on("SIGINT", signalShutdown);
process.on("SIGTERM", signalShutdown);
process.on("disconnect", signalShutdown);
const main = async (): Promise<void> => {
  let app: ReturnType<typeof spawn> | undefined;
  let appClosed: Promise<boolean> | undefined;
  let processes: ReturnType<typeof trackDemoProcesses> | undefined;
  try {
    await createDemoMirror().watch({
      signal: shutdown.signal,
      onEvent: (event) => {
        if (event.type !== "success") {
          const failure = app
            ? "FAILED. Running preview is STALE."
            : "FAILED. App has not started.";
          console.error(
            `[registry-mirror] ${event.type === "watch-error" ? "Filesystem watcher failed; content polling remains active." : failure}`,
            event.error instanceof Error
              ? event.error.message
              : String(event.error)
          );
          return;
        }
        if (app || !event.settled) {
          return;
        }
        console.info(
          "[registry-mirror] Watching canonical sources; starting reference app."
        );
        app = spawn(
          "bun",
          ["x", "turbo", "run", "dev", "--filter=@chatjs/chat"],
          {
            cwd: root,
            detached: true,
            stdio: "inherit",
          }
        );
        const closed = Promise.withResolvers<boolean>();
        appClosed = closed.promise;
        if (app.pid !== undefined) {
          processes = trackDemoProcesses(app);
        }
        {
          app?.once("error", (error) => {
            console.error(error);
            process.exitCode = 1;
            shutdown.abort();
          });
          app?.once("close", (code) => {
            if (!shutdown.signal.aborted) {
              process.exitCode = code ?? 1;
              shutdown.abort();
            }
            closed.resolve(true);
          });
        }
      },
    });
  } finally {
    if (app?.pid !== undefined) {
      const { pid } = app;
      const stop = (signal: NodeJS.Signals): void => {
        try {
          process.kill(-pid, signal);
        } catch (error) {
          if (
            !(
              error instanceof Error &&
              "code" in error &&
              error.code === "ESRCH"
            )
          ) {
            throw error;
          }
        }
      };
      stop("SIGTERM");
      // EVE also closes its detached worker on CLI IPC disconnect.
      const force = setTimeout(() => {
        stop("SIGKILL");
      }, 5000);
      await processes?.stop();
      await appClosed;
      clearTimeout(force);
      // A launcher can close before Next's remaining children have exited.
      // This group belongs only to this app, never to the sync worker or another checkout.
      stop("SIGKILL");
    }
  }
};

try {
  await main();
} finally {
  process.removeListener("SIGINT", signalShutdown);
  process.removeListener("SIGTERM", signalShutdown);
  process.removeListener("disconnect", signalShutdown);
}
