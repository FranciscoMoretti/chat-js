/* oxlint-disable import/no-nodejs-modules -- Fixture-only barriers use the disposable runtime's working directory. */
import { access, rename, writeFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
/* oxlint-enable import/no-nodejs-modules */

const mark = async (name: string, value: unknown): Promise<void> => {
  await writeFile(`${name}.json.pending`, JSON.stringify(value));
  await rename(`${name}.json.pending`, `${name}.json`);
};

const barrier = async (name: string, value: unknown): Promise<void> => {
  await mark(name, value);
  const pollIntervalMs = 100;
  /* oxlint-disable eslint/no-await-in-loop -- The fixture pauses this exact callback until the driver releases its barrier or kills the process. */
  for (;;) {
    try {
      await access(`${name}.release`);
      return;
    } catch {
      await setTimeout(pollIntervalMs);
    }
  }
  /* oxlint-enable eslint/no-await-in-loop */
};

export { barrier, mark };
