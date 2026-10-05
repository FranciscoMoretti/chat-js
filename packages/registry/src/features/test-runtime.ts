interface TestProcessResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve runTestProcess's awaited sequencing and rejected-Promise behavior. */
const runTestProcess = async (
  command: readonly string[],
  options: {
    readonly cwd?: string;
    readonly environment?: Readonly<Record<string, string | undefined>>;
  } = {}
): Promise<TestProcessResult> => {
  const child = Bun.spawn([...command], {
    cwd: options.cwd,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Conditional spread (options.environment       ? {           // oxlint-disable-next-line node/no-process-env -- Fixture overrides must inherit the current parent environment; Bun otherwise defaults to the environment captured at process launch.           env: { ...process.env, ...options.environment },         }       : {}) preserves the selected branch's own keys/values and positional overrides, including absent keys when a branch contributes none; pinned eslint/prefer-object-spread rejects Object.assign.
    ...(options.environment
      ? {
          // oxlint-disable-next-line node/no-process-env, oxc/no-rest-spread-properties -- Fixture overrides must inherit the current parent environment; Bun otherwise defaults to the environment captured at process launch. Rest/spread: Keep the existing process.env own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement. Keep the existing options.environment own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
          env: { ...process.env, ...options.environment },
        }
      : {}),
    stderr: "pipe",
    stdout: "pipe",
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    child.exited,
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
  ]);
  return { exitCode, stderr, stdout };
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (runTestProcess); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable oxc/no-async-await */
export { runTestProcess };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
