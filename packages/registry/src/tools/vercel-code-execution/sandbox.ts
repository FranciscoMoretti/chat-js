import { Sandbox } from "@vercel/sandbox";

import { env } from "@/lib/env";
import type { createModuleLogger } from "@/lib/logger";

import type { SupportedExecutionLanguage } from "./types";

export interface SandboxAuth {
  projectId: string;
  teamId: string;
  token: string;
}

const tokenClaims = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    return;
  }
  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(parts[1] ?? "", "base64url").toString("utf-8")
    );
  } catch {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  if (
    !(
      payload &&
      typeof payload === "object" &&
      "owner_id" in payload &&
      "project_id" in payload
    )
  ) {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  if (
    typeof payload.owner_id !== "string" ||
    !payload.owner_id ||
    typeof payload.project_id !== "string" ||
    !payload.project_id
  ) {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  return { projectId: payload.project_id, teamId: payload.owner_id };
};

export const getTokenAuth = (): Partial<SandboxAuth> => {
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

/** Resolve the exact provider scope before a durable allocation is reserved. */
export const resolveSandboxAuth = (): SandboxAuth => {
  const configured = getTokenAuth();
  if (configured.projectId && configured.teamId && configured.token) {
    const identity = tokenClaims(configured.token);
    if (
      identity &&
      (identity.projectId !== configured.projectId ||
        identity.teamId !== configured.teamId)
    ) {
      throw new Error(
        "Sandbox token and configured provider scope do not match."
      );
    }
    return {
      projectId: configured.projectId,
      teamId: configured.teamId,
      token: configured.token,
    };
  }
  const token = env.VERCEL_OIDC_TOKEN;
  const identity = token ? tokenClaims(token) : undefined;
  if (!(identity && token)) {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  return { ...identity, token };
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

export const createSandbox = (
  runtime: string,
  signal?: AbortSignal,
  name?: string,
  auth?: SandboxAuth
): Promise<Sandbox> =>
  Sandbox.create({
    name,
    persistent: false,
    resources: { vcpus: 2 },
    runtime,
    signal,
    timeout: 5 * 60 * 1000,
    ...(auth ?? getTokenAuth()),
  });

export const cleanupSandbox = async (
  sandbox: Pick<Sandbox, "delete" | "stop"> | undefined,
  log: Pick<ReturnType<typeof createModuleLogger>, "info" | "warn">,
  requestId: string
): Promise<void> => {
  if (!sandbox) {
    return;
  }
  try {
    try {
      await sandbox.stop({ signal: AbortSignal.timeout(30_000) });
    } finally {
      await sandbox.delete({
        deleteOrphanSnapshots: true,
        signal: AbortSignal.timeout(30_000),
      });
    }
    log.info({ requestId }, "sandbox closed");
  } catch (closeError) {
    log.warn({ closeError, requestId }, "failed to close sandbox");
    throw closeError;
  }
};

export const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Unknown error";
