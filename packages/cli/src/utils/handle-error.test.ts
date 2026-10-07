import { expect, test } from "bun:test";

const failureExitCode = 1;
const cases = [
  { error: '"message"', name: "string", output: "\nmessage\n\n" },
  {
    error: 'new Error("message")',
    name: "Error",
    output: "\nmessage\n\n",
  },
  {
    error:
      'new z.ZodError([{ code: "custom", path: ["setting"], message: "invalid setting" }])',
    name: "Zod validation error",
    output: "\nValidation failed:\n- setting: invalid setting\n\n",
  },
  { error: "{}", name: "unknown", output: "\nAn unknown error occurred.\n\n" },
] as const;

for (const scenario of cases) {
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve test's awaited sequencing and rejected-Promise behavior. */
  test(`handleError reports ${scenario.name} and stops the command`, async () => {
    const result = Bun.spawn(
      [
        process.execPath,
        "--eval",
        `import { z } from "zod";
import { handleError } from "./handle-error.ts";
handleError(${scenario.error});
console.log("command continued");`,
      ],
      {
        cwd: import.meta.dir,
        env: { NO_COLOR: "1" },
        stderr: "pipe",
        stdin: "ignore",
        stdout: "pipe",
      }
    );
    const [exitCode, stdout, stderr] = await Promise.all([
      result.exited,
      new Response(result.stdout).text(),
      new Response(result.stderr).text(),
    ]);
    expect(exitCode).toBe(failureExitCode);
    expect(stdout).toBe(scenario.output);
    expect(stderr).toBe("");
  });
  /* oxlint-enable oxc/no-async-await */
}
