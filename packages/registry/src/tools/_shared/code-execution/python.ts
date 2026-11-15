import { runCodeCommand } from "./sandbox-command";
import type {
  CodeExecutionContext,
  CodeExecutionResult,
  ExecutionSandbox,
} from "./types";
import { z } from "zod";

type PythonExecutionContext = Readonly<{
  sandbox: Readonly<ExecutionSandbox>;
  requestId: string;
  signal: AbortSignal;
  log: Readonly<Pick<CodeExecutionContext["log"], "error" | "info">>;
}>;

const pythonExecutionInfoSchema = z.looseObject({
  error: z
    .looseObject({
      name: z.string(),
      value: z.string(),
      traceback: z.string(),
    })
    .optional(),
  success: z.boolean().optional(),
});

type PythonExecutionInfo = z.infer<typeof pythonExecutionInfoSchema>;

interface PythonExecutionOutput {
  chartData: Record<string, unknown> | null;
  execInfo: PythonExecutionInfo;
  outputText: string;
}

const WHITESPACE_REGEX = /\s+/u;
const PACKAGE_SPEC_SPLIT_RE = /[=<>![\s]/u;
const isJsonObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const PROCESS_SUCCESS = 0;
const PACKAGE_NAME_INDEX = 0;
const EMPTY_PACKAGE_COUNT = 0;
const LAST_LINE_INDEX = -1;
const MISSING_CHART_INDEX = -1;
const CHART_LINE_COUNT = 1;
const EMPTY_STDERR_LENGTH = 0;

const CHART_JSON_PREFIX = "__CHART_JSON__:";

const packageName = (spec: string): string =>
  spec.split(PACKAGE_SPEC_SPLIT_RE)[PACKAGE_NAME_INDEX].toLowerCase();

const installBasePackages = async (
  basePackages: readonly string[],
  { sandbox, requestId, log, signal }: PythonExecutionContext
): Promise<{
  success: boolean;
  result?: CodeExecutionResult;
}> => {
  const installStep = await runCodeCommand(
    sandbox,
    signal,
    "/workspace/.chatjs-python/bin/pip",
    ["install", ...basePackages]
  );
  if (installStep.exitCode !== PROCESS_SUCCESS) {
    const errorOutput = installStep.stderr;
    const standardOutput = errorOutput.trim() === "" ? installStep.stdout : "";
    const installStderr = errorOutput.trim() || standardOutput.trim();
    log.error(
      { requestId, stderr: installStderr },
      "base package installation failed"
    );
    return {
      result: {
        chart: "",
        message: `Failed to install base packages: ${installStderr}`,
      },
      success: false,
    };
  }
  log.info({ requestId }, "base packages installed");
  return { success: true };
};

const pythonPackagePlan = (
  code: string,
  basePackages: readonly string[]
): { codeWithoutPipLines: string; extraPackages: string[] } => {
  const basePackageNames = new Set(
    basePackages.map((basePackageName) => basePackageName.toLowerCase())
  );
  const lines = code.split("\n");
  const pipLines = lines.filter((line) =>
    line.trim().startsWith("!pip install ")
  );
  const extraPackages = pipLines
    .flatMap((line) =>
      line
        .trim()
        .slice("!pip install ".length)
        .split(WHITESPACE_REGEX)
        .filter(Boolean)
    )
    .filter((spec) => !basePackageNames.has(packageName(spec)));

  const codeWithoutPipLines = lines
    .filter((line) => !line.trim().startsWith("!pip install "))
    .join("\n");
  return { codeWithoutPipLines, extraPackages };
};

interface PythonPackagePreparation {
  codeToRun: string;
  installResult: {
    success: boolean;
    result?: CodeExecutionResult;
  };
}

const processExtraPackages = async (
  code: string,
  basePackages: readonly string[],
  { sandbox, requestId, log, signal }: PythonExecutionContext
): Promise<PythonPackagePreparation> => {
  const { codeWithoutPipLines, extraPackages } = pythonPackagePlan(
    code,
    basePackages
  );

  if (extraPackages.length === EMPTY_PACKAGE_COUNT) {
    return { codeToRun: codeWithoutPipLines, installResult: { success: true } };
  }

  log.info(
    { packageCount: extraPackages.length, requestId },
    "installing extra packages"
  );
  const dynamicInstall = await runCodeCommand(
    sandbox,
    signal,
    "/workspace/.chatjs-python/bin/pip",
    ["install", ...extraPackages]
  );
  if (dynamicInstall.exitCode !== PROCESS_SUCCESS) {
    const errorOutput = dynamicInstall.stderr;
    const standardOutput =
      errorOutput.trim() === "" ? dynamicInstall.stdout : "";
    const stderr = errorOutput.trim() || standardOutput.trim();
    log.error(
      { exitCode: dynamicInstall.exitCode, requestId },
      "dynamic package installation failed"
    );
    return {
      codeToRun: code,
      installResult: {
        result: {
          chart: "",
          message: `Failed to install packages: ${stderr}`,
        },
        success: false,
      },
    };
  }

  return {
    codeToRun: codeWithoutPipLines,
    installResult: { success: true },
  };
};

const createWrappedCode = (codeToRun: string, chartPath: string): string => `
import sys
import json
import traceback

try:
    import matplotlib.pyplot as _plt_module
    _orig_savefig = _plt_module.savefig
    def _intercepted_savefig(*args, **kwargs):
        _orig_savefig('${chartPath}', format='png', bbox_inches='tight', dpi=100)
        _user_target = args[0] if args else kwargs.get('fname')
        if _user_target not in (None, '${chartPath}'):
            return _orig_savefig(*args, **kwargs)
    _plt_module.savefig = _intercepted_savefig
except ImportError:
    pass

try:
    exec(${JSON.stringify(codeToRun)})
    try:
        _locals = locals()
        _globals = globals()
        _chart_var = _locals.get("chart") or _globals.get("chart")
        if (isinstance(_chart_var, dict)
                and isinstance(_chart_var.get("type"), str)
                and isinstance(_chart_var.get("elements"), list)):
            print("__CHART_JSON__:" + json.dumps(_chart_var))
        else:
            if "result" in _locals:
                print(_locals["result"])
            elif "result" in _globals:
                print(_globals["result"])
            elif "results" in _locals:
                print(_locals["results"])
            elif "results" in _globals:
                print(_globals["results"])
    except Exception:
        pass
    try:
        import matplotlib.pyplot as plt
        if plt.get_fignums():
            plt.savefig('${chartPath}', format='png', bbox_inches='tight', dpi=100)
            plt.close('all')
    except ImportError:
        pass
    print(json.dumps({"success": True}))
except Exception as e:
    error_info = {"success": False, "error": {"name": type(e).__name__, "value": str(e), "traceback": traceback.format_exc()}}
    print(json.dumps(error_info))
    sys.exit(1)
`;

const parseExecutionOutput = (
  execResult: Readonly<{
    stdout: string;
    exitCode: number;
  }>
): PythonExecutionOutput => {
  const { stdout } = execResult;
  let execInfo: PythonExecutionInfo = { success: true };
  let outputText = "";
  let chartData: Record<string, unknown> | null = null;

  try {
    const outLines = (stdout ?? "").trim().split("\n");
    const lastLine = outLines.at(LAST_LINE_INDEX);
    execInfo = pythonExecutionInfoSchema.parse(JSON.parse(lastLine ?? "{}"));
    outLines.pop();

    const chartLineIdx = outLines.findIndex((line) =>
      line.startsWith(CHART_JSON_PREFIX)
    );
    if (chartLineIdx !== MISSING_CHART_INDEX) {
      const raw = outLines[chartLineIdx].slice(CHART_JSON_PREFIX.length);
      try {
        const value: unknown = JSON.parse(raw);
        if (isJsonObject(value)) {
          chartData = value;
        }
      } catch {
        // Ignore malformed chart JSON from the sandboxed snippet.
      }
      outLines.splice(chartLineIdx, CHART_LINE_COUNT);
    }

    outputText = outLines.join("\n");
  } catch {
    outputText = stdout ?? "";
    if (execResult.exitCode !== PROCESS_SUCCESS) {
      execInfo = {
        error: {
          name: "SandboxExecutionError",
          traceback: "",
          value: "Execution completed without a parsable status trailer",
        },
        success: false,
      };
    }
  }

  return { chartData, execInfo, outputText };
};

const checkForChart = async (
  chartPath: string,
  { sandbox, requestId, log, signal }: PythonExecutionContext
): Promise<{ base64: string; format: string } | undefined> => {
  const chartCheck = await runCodeCommand(sandbox, signal, "test", [
    "-f",
    chartPath,
  ]);
  if (chartCheck.exitCode === PROCESS_SUCCESS) {
    const base64Command = await runCodeCommand(sandbox, signal, "base64", [
      "-w",
      "0",
      chartPath,
    ]);
    const b64 = base64Command.stdout;
    log.info({ requestId }, "chart generated");
    return { base64: (b64 ?? "").trim(), format: "png" };
  }
  return undefined;
};

const buildResponseMessage = ({
  outputText,
  stderr,
  execInfo,
  log,
  requestId,
}: Readonly<{
  outputText: string;
  stderr: string;
  execInfo: Readonly<PythonExecutionInfo>;
  log: Readonly<Pick<CodeExecutionContext["log"], "error">>;
  requestId: string;
}>): string => {
  let message = "";

  if (outputText) {
    message += `${outputText}\n`;
  }
  if (stderr && stderr.trim().length > EMPTY_STDERR_LENGTH) {
    message += `${stderr}\n`;
  }
  if (execInfo.error) {
    message += `Error: ${execInfo.error.name}: ${execInfo.error.value}\n`;
    log.error({ error: execInfo.error, requestId }, "python execution error");
  }

  return message;
};

export const executePythonInSandbox = async ({
  sandbox,
  code,
  log,
  requestId,
  signal,
}: Readonly<
  Pick<CodeExecutionContext, "code" | "requestId" | "signal"> & {
    sandbox: Readonly<Pick<CodeExecutionContext["sandbox"], "run">>;
    log: Readonly<Pick<CodeExecutionContext["log"], "error" | "info">>;
  }
>): Promise<CodeExecutionResult> => {
  const execution = { log, requestId, sandbox, signal };
  const basePackages = [
    "matplotlib",
    "pandas",
    "numpy",
    "sympy",
    "yfinance",
  ] as const;
  const chartPath = `/tmp/chatjs-chart-${crypto.randomUUID()}.png`;
  const prepare = await sandbox.run({
    command:
      "test -x /workspace/.chatjs-python/bin/python || (sudo apt-get update && sudo apt-get install -y python3-venv && python3 -m venv /workspace/.chatjs-python)",
    signal,
  });
  if (prepare.exitCode !== 0) {
    return {
      chart: "",
      message: `Python environment setup failed: ${prepare.stderr || prepare.stdout}`,
    };
  }

  const baseInstallResult = await installBasePackages(basePackages, execution);
  if (!baseInstallResult.success) {
    return baseInstallResult.result ?? { chart: "", message: "Unknown error" };
  }

  const { codeToRun, installResult } = await processExtraPackages(
    code,
    basePackages,
    execution
  );
  if (!installResult.success) {
    return installResult.result ?? { chart: "", message: "Unknown error" };
  }

  const wrappedCode = createWrappedCode(codeToRun, chartPath);
  const execResult = await runCodeCommand(
    sandbox,
    signal,
    "/workspace/.chatjs-python/bin/python",
    ["-c", wrappedCode]
  );

  const { outputText, chartData, execInfo } = parseExecutionOutput(execResult);

  const message = buildResponseMessage({
    execInfo,
    log,
    outputText,
    requestId,
    stderr: execResult.stderr,
  });

  if (chartData) {
    log.info({ requestId }, "interactive chart data returned");
    return { chart: chartData, message: message.trim() };
  }

  const chartOut = await checkForChart(chartPath, execution);
  return {
    chart: chartOut ?? "",
    message: message.trim(),
  };
};
