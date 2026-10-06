/* oxlint-disable import/no-nodejs-modules -- Fixture effects and controls live only in the disposable local worker directory. */
import { appendFile, readFile } from "node:fs/promises";

import { z } from "zod";

import { input } from "./input";

const controls = z.object({
  ownerId: z.string().default("owner"),
  revisionId: z.string().default(input.expectedRevisionId),
});
const readControl = async (
  sessionId: string
): Promise<z.infer<typeof controls>> => {
  const source = await readFile(`proof-${sessionId}.json`, "utf-8").catch(
    () => "{}"
  );
  return controls.parse(JSON.parse(source));
};
const record = async (kind: string, detail: unknown): Promise<void> => {
  await appendFile(
    "proof-effects.jsonl",
    `${JSON.stringify({ detail, kind })}\n`
  );
};

export { readControl, record };

/* oxlint-enable import/no-nodejs-modules */
