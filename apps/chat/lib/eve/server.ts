/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../ai/types" dependency within this package instead of introducing an alias or barrel API.
 */
import { env } from "@/lib/env";

import type { UiToolName } from "../ai/types";
import { getEveConnectionOptions } from "./connection-options";
import { resolveWorkflowWorld } from "./world-config";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/strict-boolean-expressions -- typescript/strict-boolean-expressions (#610): assertEveConfigured intentionally keeps the existing falsy-value behavior of env.WORKFLOW_POSTGRES_URL; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const assertEveConfigured = (): void => {
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
/* oxlint-enable typescript/strict-boolean-expressions */

/* oxlint-disable max-params, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- max-params (#511): eveRequest keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
typescript/prefer-readonly-parameter-types (#565): eveRequest accepts init: RequestInit = {}; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
typescript/strict-boolean-expressions (#610): eveRequest intentionally keeps the existing falsy-value behavior of modelId; init.body; distinguishing empty, zero, and absent states requires a domain behavior decision. */
const eveRequest = async (
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
/* oxlint-enable max-params, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
export { assertEveConfigured, eveRequest };
