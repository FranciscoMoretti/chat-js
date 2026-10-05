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
    ...(options.environment
      ? {
          // oxlint-disable-next-line node/no-process-env -- Fixture overrides must inherit the current parent environment; Bun otherwise defaults to the environment captured at process launch.
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
/* oxlint-enable oxc/no-async-await */
export { runTestProcess };
