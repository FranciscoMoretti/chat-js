import { EventEmitter } from "node:events";
import { appendFileSync } from "node:fs";
import { access, appendFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import type { WorkerEventMap } from "graphile-worker";
import { run } from "graphile-worker";
import { z } from "zod";

const [url, directory, task] = z
  .array(z.string())
  .length(3)
  .parse(process.argv.slice(2));
// Graphile Worker requires its Node EventEmitter interface for lifecycle evidence.
// oxlint-disable-next-line unicorn/prefer-event-target
const events = new EventEmitter();
events.on("job:start", ({ worker, job }: WorkerEventMap["job:start"]) => {
  appendFileSync(
    path.join(directory, `${task}.starts`),
    `${JSON.stringify({
      individualWorkerId: worker.workerId,
      jobId: job.id,
      pid: process.pid,
      workerId: z.string().parse(job.locked_by),
    })}\n`
  );
});
events.on("resetLocked:success", () => {
  appendFileSync(path.join(directory, `${task}.scans`), `${process.pid}\n`);
});
const runner = await run({
  concurrency: 1,
  connectionString: url,
  events,
  maxResetLockedInterval: 100,
  minResetLockedInterval: 100,
  pollInterval: 100,
  taskList: {
    [task]: async (payload) => {
      const input = z
        .object({ action: z.literal("original"), amount: z.literal(7) })
        .parse(payload);
      // The external release file is a serial barrier before the original side effect.
      /* oxlint-disable no-await-in-loop */
      while (
        !(await access(path.join(directory, `${task}.release`)).then(
          () => true,
          () => false
        ))
      ) {
        await delay(50);
      }
      /* oxlint-enable no-await-in-loop */
      await appendFile(
        path.join(directory, `${task}.effects`),
        `${JSON.stringify(input)}\n`
      );
    },
  },
});
await runner.promise;
