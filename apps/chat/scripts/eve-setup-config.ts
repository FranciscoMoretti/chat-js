export const resolveEveSetup = (world: string, databaseUrl?: string) => {
  if (world === "vercel") {
    return { local: false, managed: true };
  }
  if (world !== "@workflow/world-postgres") {
    throw new Error(
      `ChatJS setup does not support world "${world}". Add and verify its setup and lifecycle support before using it.`
    );
  }
  let target: URL;
  try {
    target = new URL(databaseUrl ?? "");
    decodeURIComponent(target.hostname);
    if (!target.hostname || target.pathname.length < 2) {
      throw new Error("Missing database host or name");
    }
  } catch {
    throw new Error(
      "Set WORKFLOW_POSTGRES_URL to a PostgreSQL connection URL."
    );
  }
  if (!["postgres:", "postgresql:"].includes(target.protocol)) {
    throw new Error(
      "WORKFLOW_POSTGRES_URL must use postgres:// or postgresql://."
    );
  }
  return {
    local: ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
    managed: false,
  };
};
