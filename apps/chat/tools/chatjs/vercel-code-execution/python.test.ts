import { expect, it, vi } from "vitest";
import type { Logger } from "pino";
import type { MockInstance } from "vitest";
import { Sandbox } from "@vercel/sandbox";
import { executePythonInSandbox } from "@/tools/chatjs/_shared/code-execution/python";
import pino from "pino";

const mocks = vi.hoisted(() => ({ runCommand: vi.fn() }));
vi.mock(
  "@vercel/sandbox",
  (): {
    Sandbox: { create: () => { runCommand: typeof mocks.runCommand } };
  } => ({
    Sandbox: {
      create: (): { runCommand: typeof mocks.runCommand } => ({
        runCommand: mocks.runCommand,
      }),
    },
  })
);
const SUCCESS_EXIT_CODE = 0;
const FAILED_EXIT_CODE = 1;
const PIP_COMMAND_ORDINAL = 2;
const CHART_COMMAND_COUNT = 2;
const FALLBACK_COMMAND_COUNT = 3;

const createPipRedactionFixture = (
  packageUrl: string,
  exitCode: number
): {
  log: Logger;
  info: MockInstance<Logger["info"]>;
  error: MockInstance<Logger["error"]>;
} => {
  const log = pino({ level: "silent" });
  const info = vi.spyOn(log, "info");
  const error = vi.spyOn(log, "error");
  mocks.runCommand.mockReset();
  mocks.runCommand
    .mockResolvedValueOnce({ exitCode: SUCCESS_EXIT_CODE })
    .mockResolvedValueOnce({
      exitCode,
      stderr: (): string => `Could not install ${packageUrl}`,
    })
    .mockResolvedValueOnce({
      exitCode: SUCCESS_EXIT_CODE,
      stderr: (): string => "",
      stdout: (): string => '{"success":true}',
    })
    .mockResolvedValueOnce({ exitCode: FAILED_EXIT_CODE });
  return {
    error,
    info,
    log,
  };
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve it.each([0, 1])'s awaited sequencing and rejected-Promise behavior. */

it.each([SUCCESS_EXIT_CODE, FAILED_EXIT_CODE])(
  "does not log package credentials when pip exits with %s",
  async (exitCode) => {
    const secret = "fake-private-package-token";
    const packageUrl = `https://user:${secret}@packages.example.com/private.whl`;
    const { log, info, error } = createPipRedactionFixture(
      packageUrl,
      exitCode
    );

    await executePythonInSandbox({
      code: `!pip install ${packageUrl}\nprint(4)`,
      log,
      requestId: "test-request",
      sandbox: await Sandbox.create(),
    });

    expect(mocks.runCommand).toHaveBeenNthCalledWith(PIP_COMMAND_ORDINAL, {
      args: ["install", packageUrl],
      cmd: "pip",
    });
    expect(info).toHaveBeenCalledWith(
      { packageCount: 1, requestId: "test-request" },
      "installing extra packages"
    );
    expect(JSON.stringify([info.mock.calls, error.mock.calls])).not.toContain(
      secret
    );
    if (exitCode !== SUCCESS_EXIT_CODE) {
      expect(error).toHaveBeenCalledWith(
        { exitCode, requestId: "test-request" },
        "dynamic package installation failed"
      );
    }
  }
);
/* oxlint-enable oxc/no-async-await */

it.each([
  {
    chart: '{"type":"line","elements":[],"extension":true}',
    commandCount: CHART_COMMAND_COUNT,
    expectedChart: { elements: [], extension: true, type: "line" },
  },
  {
    chart: "null",
    commandCount: FALLBACK_COMMAND_COUNT,
    expectedChart: "",
  },
  {
    chart: "[]",
    commandCount: FALLBACK_COMMAND_COUNT,
    expectedChart: "",
  },
  {
    chart: '"text"',
    commandCount: FALLBACK_COMMAND_COUNT,
    expectedChart: "",
  },
  {
    chart: "false",
    commandCount: FALLBACK_COMMAND_COUNT,
    expectedChart: "",
  },
  {
    chart: "42",
    commandCount: FALLBACK_COMMAND_COUNT,
    expectedChart: "",
  },
  {
    chart: "{",
    commandCount: FALLBACK_COMMAND_COUNT,
    expectedChart: "",
  },
])(
  "chart envelope $chart is accepted only when it is an object",
  // oxlint-disable-next-line oxc/no-async-await -- Await the mocked sandbox command lifecycle for each wire-envelope fixture.
  async ({
    chart,
    expectedChart,
    commandCount,
  }: Readonly<{
    chart: string;
    expectedChart:
      | string
      | Readonly<{
          elements: readonly never[];
          extension: boolean;
          type: string;
        }>;
    commandCount: number;
  }>): Promise<void> => {
    mocks.runCommand.mockReset();
    mocks.runCommand
      .mockResolvedValueOnce({ exitCode: SUCCESS_EXIT_CODE })
      .mockResolvedValueOnce({
        exitCode: SUCCESS_EXIT_CODE,
        stderr: (): string => "",
        stdout: (): string =>
          `printed output\n__CHART_JSON__:${chart}\n{"success":true}`,
      })
      .mockResolvedValueOnce({ exitCode: FAILED_EXIT_CODE });
    const result = await executePythonInSandbox({
      code: "print('output')",
      log: pino({ level: "silent" }),
      requestId: "chart-envelope",
      sandbox: await Sandbox.create(),
    });
    expect(result.message).toBe("printed output");
    expect(result.chart).toEqual(expectedChart);
    expect(mocks.runCommand).toHaveBeenCalledTimes(commandCount);
  }
);
