import { getEveRuntimeEnvOptions } from "../lib/env-schema";

export const resolveEveSetup = (
  world: string,
  databaseUrl?: string
):
  | { local: false; managed: true }
  | { local: boolean; managed: false; databaseUrl: string } => {
  if (world === "vercel") {
    return { local: false, managed: true };
  }
  if (world !== "@workflow/world-postgres") {
    throw new Error(
      `ChatJS setup does not support world "${world}". Add and verify its setup and lifecycle support before using it.`
    );
  }
  if (!databaseUrl) {
    throw new Error(
      "Set WORKFLOW_POSTGRES_URL to a direct or session PostgreSQL runtime URL, or provide DATABASE_URL as the fallback."
    );
  }
  const validated = getEveRuntimeEnvOptions({}).WORKFLOW_POSTGRES_URL.safeParse(
    databaseUrl
  );
  if (!validated.success) {
    throw new Error(
      `WORKFLOW_POSTGRES_URL must be a direct or session PostgreSQL URL. ${validated.error.issues.map((issue) => issue.message).join(" ")}`
    );
  }
  let target: URL;
  try {
    target = new URL(validated.data ?? "");
    decodeURIComponent(target.hostname);
    if (!target.hostname || target.pathname.length < 2) {
      throw new Error("Missing database host or name");
    }
  } catch {
    throw new Error(
      "Set WORKFLOW_POSTGRES_URL to a PostgreSQL connection URL."
    );
  }
  return {
    databaseUrl,
    local: ["localhost", "127.0.0.1", "[::1]"].includes(target.hostname),
    managed: false,
  };
};
