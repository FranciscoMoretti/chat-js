import { getEveRuntimeEnvOptions } from "@/lib/env-schema";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (resolveEveSetup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */

/* oxlint-disable init-declarations, max-statements --
 * init-declarations (#507): URL parsing assigns target in the try block; the catch exits by throwing the normalized error, so later hostname classification only runs after definite assignment and needs no undefined sentinel.
 * max-statements (#512): This 17-statement workflow preserves ordered world selection, URL validation, and normalized URL-error behavior; extracting URL validation remains pending separate error-boundary review.
 */
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
  if (typeof databaseUrl !== "string" || databaseUrl === "") {
    throw new Error(
      "Set WORKFLOW_POSTGRES_URL to a direct or session PostgreSQL runtime URL, or provide DATABASE_URL as the fallback."
    );
  }
  const validated = getEveRuntimeEnvOptions({}).WORKFLOW_POSTGRES_URL.safeParse(
    databaseUrl
  );
  if (!validated.success) {
    throw new Error(
      `WORKFLOW_POSTGRES_URL must be a direct or session PostgreSQL URL. ${validated.error.issues.map((issue: { readonly message: string }) => issue.message).join(" ")}`
    );
  }
  let target: URL;
  try {
    target = new URL(validated.data ?? "");
    decodeURIComponent(target.hostname);
    if (!target.hostname || target.pathname === "" || target.pathname === "/") {
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
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable init-declarations, max-statements */
