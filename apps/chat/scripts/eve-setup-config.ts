/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../lib/env-schema" dependency within this package instead of introducing an alias or barrel API.
 */
import { getEveRuntimeEnvOptions } from "../lib/env-schema";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (resolveEveSetup); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable init-declarations, max-statements, typescript/prefer-readonly-parameter-types --
 * init-declarations (#507): resolveEveSetup assigns these bindings along its control-flow paths; eager undefined initialization would conflict with no-undefined and obscure definite assignment.
 * max-statements (#512): resolveEveSetup keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * typescript/prefer-readonly-parameter-types (#565): resolveEveSetup accepts issue; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
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
      `WORKFLOW_POSTGRES_URL must be a direct or session PostgreSQL URL. ${validated.error.issues.map((issue) => issue.message).join(" ")}`
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
/* oxlint-enable init-declarations, max-statements, typescript/prefer-readonly-parameter-types */
