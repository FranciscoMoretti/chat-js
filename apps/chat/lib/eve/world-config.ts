/** Shared by agent compilation, runtime validation and setup; no user backend switch. */
export const resolveWorkflowWorld = (
  environment: {
    VERCEL?: string;
    VERCEL_ENV?: string;
    NODE_ENV?: string;
  } = process.env
) => {
  // `vercel dev` / pulled development environments still use local PostgreSQL.
  // NODE_ENV alone never selects managed Workflow (self-hosted builds are production too).
  const deployed =
    environment.VERCEL === "1" &&
    environment.VERCEL_ENV !== "development" &&
    environment.NODE_ENV !== "development";
  return deployed ? "vercel" : "@workflow/world-postgres";
};
