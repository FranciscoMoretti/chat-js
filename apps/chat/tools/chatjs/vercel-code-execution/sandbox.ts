import { Sandbox } from "@vercel/sandbox";

import { env } from "@/lib/env";
import type { createModuleLogger } from "@/lib/logger";

import type { SupportedExecutionLanguage } from "./types";

export const getTokenAuth = (): Record<string, string> => {
  const { VERCEL_TEAM_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN } = env;
  if (VERCEL_TEAM_ID && VERCEL_PROJECT_ID && VERCEL_TOKEN) {
    return {
      projectId: VERCEL_PROJECT_ID,
      teamId: VERCEL_TEAM_ID,
      token: VERCEL_TOKEN,
    };
  }
  return {};
};

export const getSandboxRuntime = (
  language: SupportedExecutionLanguage
): string => {
  if (language === "javascript") {
    return env.VERCEL_SANDBOX_RUNTIME_JAVASCRIPT ?? "node22";
  }

  return (
    env.VERCEL_SANDBOX_RUNTIME_PYTHON ??
    env.VERCEL_SANDBOX_RUNTIME ??
    "python3.13"
  );
};

export const createSandbox = (runtime: string): Promise<Sandbox> =>
  Sandbox.create({
    resources: { vcpus: 2 },
    runtime,
    timeout: 5 * 60 * 1000,
    ...getTokenAuth(),
  });

export const cleanupSandbox = async (
  sandbox: Sandbox | undefined,
  log: ReturnType<typeof createModuleLogger>,
  requestId: string
): Promise<void> => {
  if (!sandbox) {
    return;
  }
  try {
    await sandbox.stop();
    log.info({ requestId }, "sandbox closed");
  } catch (error) {
    log.warn({ error, requestId }, "failed to close sandbox");
  }
};

export const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Unknown error";
