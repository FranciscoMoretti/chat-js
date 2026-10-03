/* oxlint-disable import/no-nodejs-modules -- This code runs on the Node/Bun server or installer and requires the built-in operating-system API. */
import { spawn } from "node:child_process";
/* oxlint-enable import/no-nodejs-modules */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
export const runCommand = async (
  command: string,
  args: string[],
  cwd: string
): Promise<void> => {
  const { promise, resolve, reject } = Promise.withResolvers<undefined>();
  const child = spawn(command, args, { cwd, stdio: "pipe" });
  const stderr: string[] = [];
  child.stderr?.on("data", (data) => {
    stderr.push(String(data));
  });
  child.on("error", reject);
  child.on("close", (code) => {
    if (code === 0) {
      resolve(undefined);
    } else {
      reject(
        new Error(
          `${command} exited with code ${code}\n${stderr.join("")}`.trim()
        )
      );
    }
  });
  await promise;
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-magic-numbers */
