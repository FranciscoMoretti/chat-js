import type { Sandbox } from "@vercel/sandbox";

import type { CodeExecutionContext, CodeExecutionResult } from "./types";

const WHITESPACE_REGEX = /\s+/u;
const PACKAGE_SPEC_SPLIT_RE = /[=<>![\s]/u;
const CHART_JSON_PREFIX = "__CHART_JSON__:";

function packageName(spec: string): string {
  return spec.split(PACKAGE_SPEC_SPLIT_RE)[0].toLowerCase();
}

async function installBasePackages(
  sandbox: Sandbox,
  basePackages: readonly string[],
  requestId: string,
  log: CodeExecutionContext["log"]
): Promise<{
  success: boolean;
  result?: CodeExecutionResult;
}> {
  const installStep = await sandbox.runCommand({
    cmd: "pip",
    args: ["install", ...basePackages],
  });
  if (installStep.exitCode !== 0) {
    const installStderr = await installStep.stderr();
    log.error(
      { requestId, stderr: installStderr },
      "base package installation failed"
    );
    return {
      success: false,
      result: {
        message: `Failed to install base packages: ${installStderr}`,
        chart: "",
      },
    };
  }
  log.info({ requestId }, "base packages installed");
  return { success: true };
}

async function processExtraPackages(
  code: string,
  basePackages: readonly string[],
  sandbox: Sandbox,
  requestId: string,
  log: CodeExecutionContext["log"]
): Promise<{
  codeToRun: string;
  installResult: {
    success: boolean;
    result?: CodeExecutionResult;
  };
}> {
  const basePackageNames = new Set(basePackages.map((p) => p.toLowerCase()));
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

  if (extraPackages.length === 0) {
    return { codeToRun: codeWithoutPipLines, installResult: { success: true } };
  }

  log.info(
    { requestId, packageCount: extraPackages.length },
    "installing extra packages"
  );
  const dynamicInstall = await sandbox.runCommand({
    cmd: "pip",
    args: ["install", ...extraPackages],
  });
  if (dynamicInstall.exitCode !== 0) {
    const stderr = await dynamicInstall.stderr();
    log.error(
      { requestId, exitCode: dynamicInstall.exitCode },
      "dynamic package installation failed"
    );
    return {
      codeToRun: code,
      installResult: {
        success: false,
        result: {
          message: `Failed to install packages: ${stderr}`,
          chart: "",
        },
      },
    };
  }

  return {
    codeToRun: codeWithoutPipLines,
    installResult: { success: true },
  };
}

function createWrappedCode(codeToRun: string, chartPath: string): string {
  return `
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
}

async function parseExecutionOutput(execResult: {
  stdout: () => Promise<string>;
  exitCode: number;
}): Promise<{
  outputText: string;
  chartData: Record<string, unknown> | null;
  execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  };
}> {
  const stdout = await execResult.stdout();
  let execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  } = { success: true };
  let outputText = "";
  let chartData: Record<string, unknown> | null = null;

  try {
    const outLines = (stdout ?? "").trim().split("\n");
    const lastLine = outLines.at(-1);
    execInfo = JSON.parse(lastLine ?? "{}");
    outLines.pop();

    const chartLineIdx = outLines.findIndex((line) =>
      line.startsWith(CHART_JSON_PREFIX)
    );
    if (chartLineIdx !== -1) {
      const raw = outLines[chartLineIdx].slice(CHART_JSON_PREFIX.length);
      try {
        chartData = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        // Ignore malformed chart JSON from the sandboxed snippet.
      }
      outLines.splice(chartLineIdx, 1);
    }

    outputText = outLines.join("\n");
  } catch {
    outputText = stdout ?? "";
    if (execResult.exitCode !== 0) {
      execInfo = {
        success: false,
        error: {
          name: "SandboxExecutionError",
          value: "Execution completed without a parsable status trailer",
          traceback: "",
        },
      };
    }
  }

  return { outputText, chartData, execInfo };
}

async function checkForChart(
  sandbox: Sandbox,
  chartPath: string,
  requestId: string,
  log: CodeExecutionContext["log"]
): Promise<{ base64: string; format: string } | undefined> {
  const chartCheck = await sandbox.runCommand({
    cmd: "test",
    args: ["-f", chartPath],
  });
  if (chartCheck.exitCode === 0) {
    const base64Command = await sandbox.runCommand({
      cmd: "base64",
      args: ["-w", "0", chartPath],
    });
    const b64 = await base64Command.stdout();
    log.info({ requestId }, "chart generated");
    return { base64: (b64 ?? "").trim(), format: "png" };
  }
}

function buildResponseMessage({
  outputText,
  stderr,
  execInfo,
  log,
  requestId,
}: {
  outputText: string;
  stderr: string;
  execInfo: {
    success: boolean;
    error?: { name: string; value: string; traceback: string };
  };
  log: CodeExecutionContext["log"];
  requestId: string;
}): string {
  let message = "";

  if (outputText) {
    message += `${outputText}\n`;
  }
  if (stderr && stderr.trim().length > 0) {
    message += `${stderr}\n`;
  }
  if (execInfo.error) {
    message += `Error: ${execInfo.error.name}: ${execInfo.error.value}\n`;
    log.error({ requestId, error: execInfo.error }, "python execution error");
  }

  return message;
}

export async function executePythonInSandbox({
  sandbox,
  code,
  log,
  requestId,
}: CodeExecutionContext): Promise<CodeExecutionResult> {
  const basePackages = [
    "matplotlib",
    "pandas",
    "numpy",
    "sympy",
    "yfinance",
  ] as const;
  const chartPath = "/tmp/chart.png";

  const baseInstallResult = await installBasePackages(
    sandbox,
    basePackages,
    requestId,
    log
  );
  if (!baseInstallResult.success) {
    return baseInstallResult.result ?? { message: "Unknown error", chart: "" };
  }

  const { codeToRun, installResult } = await processExtraPackages(
    code,
    basePackages,
    sandbox,
    requestId,
    log
  );
  if (!installResult.success) {
    return installResult.result ?? { message: "Unknown error", chart: "" };
  }

  const wrappedCode = createWrappedCode(codeToRun, chartPath);
  const execResult = await sandbox.runCommand({
    cmd: "python3",
    args: ["-c", wrappedCode],
  });

  const { outputText, chartData, execInfo } =
    await parseExecutionOutput(execResult);

  const message = buildResponseMessage({
    outputText,
    stderr: await execResult.stderr(),
    execInfo,
    log,
    requestId,
  });

  if (chartData) {
    log.info({ requestId }, "interactive chart data returned");
    return { message: message.trim(), chart: chartData };
  }

  const chartOut = await checkForChart(sandbox, chartPath, requestId, log);
  return {
    message: message.trim(),
    chart: chartOut ?? "",
  };
}
