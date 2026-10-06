import { getVercelOidcTokenSync } from "@vercel/oidc";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { APIError, Sandbox } from "@vercel/sandbox";
/* oxlint-enable sort-imports */

import type { CodeSandboxCleanupCapability } from "@/lib/ai/installed-tool-capabilities";
import { env } from "@/lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { SupportedExecutionLanguage } from "@/tools/chatjs/_shared/code-execution/types";
/* oxlint-enable sort-imports */

interface SandboxAuth {
  projectId: string;
  teamId: string;
  token: string;
}

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
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
  // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
  return { projectId: payload.project_id, teamId: payload.owner_id };
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-statements */

const getTokenAuth = (): Partial<SandboxAuth> => {
  const { VERCEL_TEAM_ID, VERCEL_PROJECT_ID, VERCEL_TOKEN } = env;
  if (
    typeof VERCEL_TEAM_ID === "string" &&
    VERCEL_TEAM_ID !== "" &&
    typeof VERCEL_PROJECT_ID === "string" &&
    VERCEL_PROJECT_ID !== "" &&
    typeof VERCEL_TOKEN === "string" &&
    VERCEL_TOKEN !== ""
  ) {
    return {
      projectId: VERCEL_PROJECT_ID,
      teamId: VERCEL_TEAM_ID,
      token: VERCEL_TOKEN,
    };
  }
  return {};
};

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/** Resolve the exact provider scope before a durable allocation is reserved. */
const resolveSandboxAuth = (): SandboxAuth => {
  const configured = getTokenAuth();
  if (
    typeof configured.projectId === "string" &&
    configured.projectId !== "" &&
    typeof configured.teamId === "string" &&
    configured.teamId !== "" &&
    typeof configured.token === "string" &&
    configured.token !== ""
  ) {
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
  // Vercel supplies production tokens through the current request context.
  let token: string;
  try {
    token = getVercelOidcTokenSync();
  } catch {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  // oxlint-disable-next-line no-ternary -- Keep identity as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const identity = token ? tokenClaims(token) : undefined;
  if (!(identity && token)) {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing identity own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
  return { ...identity, token };
};
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */

const getSandboxRuntime = (language: SupportedExecutionLanguage): string => {
  if (language === "javascript") {
    return env.VERCEL_SANDBOX_RUNTIME_JAVASCRIPT ?? "node22";
  }

  return (
    env.VERCEL_SANDBOX_RUNTIME_PYTHON ??
    env.VERCEL_SANDBOX_RUNTIME ??
    "python3.13"
  );
};

/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
const createSandbox = (
  runtime: string,
  signal?: AbortSignal,
  name?: string,
  auth?: SandboxAuth
): Promise<Sandbox> =>
  Sandbox.create({
    name,
    persistent: false,
    resources: { vcpus: 2 },
    // oxlint-disable-next-line typescript/no-deprecated -- The pinned Sandbox SDK still accepts this configured runtime; switching runtime identifiers requires execution compatibility validation.
    runtime,
    signal,
    timeout: 5 * 60 * 1000,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing (auth ?? getTokenAuth()) own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...(auth ?? getTokenAuth()),
  });
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve cleanupSandbox's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-params */

/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
const cleanupSandbox = async (
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
/* oxlint-enable oxc/no-async-await */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve findSandboxForCleanup's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable eslint/no-magic-numbers */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const findSandboxForCleanup = async (name: string, auth: SandboxAuth) => {
  try {
    return await Sandbox.get({
      name,
      resume: false,
      signal: AbortSignal.timeout(15_000),
      // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing auth own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
      ...auth,
    });
  } catch (error) {
    if (error instanceof APIError && error.response.status === 404) {
      // oxlint-disable-next-line typescript/consistent-return -- This lookup or optional operation intentionally returns no value when the target is absent; callers already handle the value-or-undefined contract.
      return;
    }
    throw error;
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable typescript/explicit-function-return-type */

const codeSandboxCleanupCapability: CodeSandboxCleanupCapability = {
  createCleanupSession: () => {
    const auth = resolveSandboxAuth();
    const log = createModuleLogger("eve-code-sandbox-cleanup");
    return {
      /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve deleteAndConfirmAbsent's awaited sequencing and rejected-Promise behavior. */
      async deleteAndConfirmAbsent(name): Promise<void> {
        const sandbox = await findSandboxForCleanup(name, auth);
        if (sandbox) {
          if (sandbox.name !== name || sandbox.persistent) {
            throw new Error(
              "Code sandbox identity or persistence needs reconciliation."
            );
          }
          await cleanupSandbox(sandbox, log, name);
          if (await findSandboxForCleanup(name, auth)) {
            throw new Error("Code sandbox remains available after deletion.");
          }
        }
      },
      /* oxlint-enable oxc/no-async-await */
      provider: auth,
    };
  },
};

const getErrorMessage = (err: unknown): string => {
  if (err instanceof Error) {
    return err.message;
  }
  return "Unknown error";
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (cleanupSandbox, codeSandboxCleanupCapability, createSandbox, getErrorMessage, getSandboxRuntime, getTokenAuth, resolveSandboxAuth); the enabled import/no-default-export convention rejects the default-export alternative. */
export {
  cleanupSandbox,
  codeSandboxCleanupCapability,
  createSandbox,
  getErrorMessage,
  getSandboxRuntime,
  getTokenAuth,
  resolveSandboxAuth,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (SandboxAuth); the enabled import/no-default-export convention rejects the default-export alternative. */
export type { SandboxAuth };
/* oxlint-enable import/no-named-export */
