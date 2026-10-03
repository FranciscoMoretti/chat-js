import { getVercelOidcTokenSync } from "@vercel/oidc";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { APIError, Sandbox } from "@vercel/sandbox";
/* oxlint-enable eslint/sort-imports */

import type { CodeSandboxCleanupCapability } from "@/lib/ai/installed-tool-capabilities";
import { env } from "@/lib/env";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createModuleLogger } from "@/lib/logger";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { SupportedExecutionLanguage } from "./types";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export interface SandboxAuth {
  projectId: string;
  teamId: string;
  token: string;
}
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/exports-last */

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

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const getTokenAuth = (): Partial<SandboxAuth> => {
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
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable jsdoc/require-returns -- The comment documents lifecycle behavior; the TypeScript return contract remains the authoritative result description. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/init-declarations -- The value is assigned by the following guarded operation; an invented initial value would hide an uninitialized control-flow branch. */
/* oxlint-disable node/no-sync -- This bounded synchronous operation is required during initialization or deterministic test/installer setup. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
/* oxlint-disable eslint/no-undefined -- Undefined represents an omitted optional argument or absent value in the existing TypeScript/SDK contract. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/** Resolve the exact provider scope before a durable allocation is reserved. */
export const resolveSandboxAuth = (): SandboxAuth => {
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
  const identity = token ? tokenClaims(token) : undefined;
  if (!(identity && token)) {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  return { ...identity, token };
};
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-undefined */
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable node/no-sync */
/* oxlint-enable eslint/init-declarations */
/* oxlint-enable import/no-named-export */
/* oxlint-enable jsdoc/require-returns */
/* oxlint-enable eslint/max-statements */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/max-params -- This adapter implements the existing positional callback contract; changing it requires updating every caller. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/promise-function-async -- Return the existing promise directly to preserve its identity and the current synchronous-throw boundary. */
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
    // oxlint-disable-next-line typescript/no-deprecated -- The pinned Sandbox SDK still accepts this configured runtime; switching runtime identifiers requires execution compatibility validation.
    runtime,
    signal,
    timeout: 5 * 60 * 1000,
    ...(auth ?? getTokenAuth()),
  });
/* oxlint-enable typescript/promise-function-async */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable eslint/max-params */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
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
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
/* oxlint-disable eslint/no-magic-numbers -- These literals encode local protocol limits, indexing, or fixture expectations; keep them beside the operation whose units they describe. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const findSandboxForCleanup = async (name: string, auth: SandboxAuth) => {
  try {
    return await Sandbox.get({
      name,
      resume: false,
      signal: AbortSignal.timeout(15_000),
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable eslint/no-magic-numbers */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable oxc/no-async-await -- Await preserves the existing sequencing, rejection propagation, and cleanup behavior of this asynchronous operation. */
export const codeSandboxCleanupCapability: CodeSandboxCleanupCapability = {
  createCleanupSession: () => {
    const auth = resolveSandboxAuth();
    const log = createModuleLogger("eve-code-sandbox-cleanup");
    return {
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
      provider: auth,
    };
  },
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable eslint/no-ternary -- This expression selects a value without introducing mutable intermediate state or changing evaluation order. */
export const getErrorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : "Unknown error";
/* oxlint-enable eslint/no-ternary */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
