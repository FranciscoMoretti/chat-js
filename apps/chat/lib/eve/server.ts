/* oxlint-disable import/no-relative-parent-imports, sort-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import { env } from "@/lib/env";

import type { UiToolName } from "../ai/types";
import { getEveConnectionOptions } from "./connection-options";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-enable import/no-relative-parent-imports, sort-imports */

/* oxlint-disable import/group-exports, import/no-named-export, typescript/strict-boolean-expressions --
 * import/group-exports (#523): assertEveConfigured stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named assertEveConfigured API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/strict-boolean-expressions (#610): assertEveConfigured intentionally keeps the existing falsy-value behavior of env.WORKFLOW_POSTGRES_URL; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const assertEveConfigured = (): void => {
  if (
    !(
      env.EVE_INTERNAL_ORIGIN &&
      env.EVE_GATEWAY_SECRET &&
      (resolveWorkflowWorld(env) === "vercel" || env.WORKFLOW_POSTGRES_URL)
    )
  ) {
    throw new Error(
      "Configure the Eve origin, gateway secret and local workflow database (outside Vercel) before starting a conversation."
    );
  }
};
/* oxlint-enable import/group-exports, import/no-named-export, typescript/strict-boolean-expressions */

/* oxlint-disable import/group-exports, import/no-named-export, max-params, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): eveRequest stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named eveRequest API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * max-params (#511): eveRequest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * oxc/no-async-await (#540): eveRequest sequences asynchronous I/O and failure handling with await; promise-function-async also requires async implementations.
 * oxc/no-rest-spread-properties (#543): eveRequest copies or separates ...connection.headers; ...init while preserving existing object ownership; mutating source objects is not equivalent.
 * typescript/prefer-readonly-parameter-types (#565): eveRequest accepts init: RequestInit = {}; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): eveRequest intentionally keeps the existing falsy-value behavior of modelId; init.body; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
export const eveRequest = async (
  owner: string,
  path: string,
  init: RequestInit = {},
  modelId?: string,
  selectedTool?: UiToolName
): Promise<Response> => {
  assertEveConfigured();
  const connection = getEveConnectionOptions(owner);
  const headers = new Headers({
    ...connection.headers,
    authorization: `Bearer ${connection.auth.bearer}`,
  });
  if (modelId) {
    headers.set("x-chatjs-model", modelId);
  }
  if (selectedTool) {
    headers.set("x-chatjs-tool", selectedTool);
  }
  if (init.body) {
    headers.set("content-type", "application/json");
  }
  return await fetch(new URL(path, connection.host), {
    ...init,
    cache: "no-store",
    headers,
    redirect: "error",
  });
};
/* oxlint-enable import/group-exports, import/no-named-export, max-params, oxc/no-async-await, oxc/no-rest-spread-properties, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
