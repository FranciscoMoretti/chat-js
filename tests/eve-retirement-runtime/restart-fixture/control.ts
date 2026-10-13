import { access, rename, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";

const mark = async (name: string, value: unknown): Promise<void> => {
  await writeFile(`${name}.json.pending`, JSON.stringify(value));
  await rename(`${name}.json.pending`, `${name}.json`);
};

const barrier = async (name: string, value: unknown): Promise<void> => {
  await mark(name, { pid: process.pid, value });
  const pollIntervalMs = 100;
  // The fixture barrier must observe a release before continuing; probes cannot overlap.
  /* oxlint-disable no-await-in-loop */
  for (;;) {
    try {
      await access(`${name}.release`);
      return;
    } catch {
      await setTimeout(pollIntervalMs);
    }
  }
  /* oxlint-enable no-await-in-loop */
};

export { barrier, mark };
