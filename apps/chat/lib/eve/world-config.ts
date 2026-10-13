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

  if (deployed) {
    return "vercel";
  }
  return "@workflow/world-postgres";
};
