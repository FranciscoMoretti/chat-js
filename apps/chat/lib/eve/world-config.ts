/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (resolveWorkflowWorld); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable node/no-process-env -- * node/no-process-env (#537): resolveWorkflowWorld reads process.env at the environment/configuration boundary; moving this access requires preserving runtime and test override behavior. */
/**
 * Shared by agent compilation, runtime validation and setup; no user backend switch.
 * @param {{ readonly VERCEL?: string; readonly VERCEL_ENV?: string; readonly NODE_ENV?: string; }} environment Deployment flags, defaulting to the current process environment.
 * @returns {"vercel" | "@workflow/world-postgres"} The managed world only for a deployed nondevelopment Vercel environment; otherwise the PostgreSQL world.
 */
export const resolveWorkflowWorld = (
  environment: {
    readonly VERCEL?: string;
    readonly VERCEL_ENV?: string;
    readonly NODE_ENV?: string;
  } = process.env
): "vercel" | "@workflow/world-postgres" => {
  // `vercel dev` / pulled development environments still use local PostgreSQL.
  // NODE_ENV alone never selects managed Workflow (self-hosted builds are production too).
  const deployed =
    environment.VERCEL === "1" &&
    environment.VERCEL_ENV !== "development" &&
    environment.NODE_ENV !== "development";
  return deployed ? "vercel" : "@workflow/world-postgres";
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable node/no-process-env */
