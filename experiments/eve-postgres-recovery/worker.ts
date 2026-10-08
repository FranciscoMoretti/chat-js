/* oxlint-disable eslint/no-await-in-loop, eslint/no-magic-numbers, import/no-nodejs-modules, node/no-sync, typescript/prefer-readonly-parameter-types, unicorn/prefer-event-target --
 * eslint/no-await-in-loop: Observe ordered runtime evidence and retirement stages without reordering or redispatch.
 * eslint/no-magic-numbers: Bounded proof deadlines, fixture counts and archive permissions are explicit protocol inputs.
 * import/no-nodejs-modules: The disposable proof owns local files and child processes.
 * node/no-sync: Persist the worker ownership registration synchronously before its task begins.
 * typescript/prefer-readonly-parameter-types: The database and runtime SDKs own these mutable parameter types; proofs do not mutate them.
 * unicorn/prefer-event-target: Graphile Worker accepts the Node EventEmitter contract.
 */
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
      while (
        !(await access(path.join(directory, `${task}.release`)).then(
          () => true,
          () => false
        ))
      ) {
        await delay(50);
      }
      await appendFile(
        path.join(directory, `${task}.effects`),
        `${JSON.stringify(input)}\n`
      );
    },
  },
});
await runner.promise;

/* oxlint-enable eslint/no-await-in-loop, eslint/no-magic-numbers, import/no-nodejs-modules, node/no-sync, typescript/prefer-readonly-parameter-types, unicorn/prefer-event-target */
