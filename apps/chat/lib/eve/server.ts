import type { UiToolName } from "@/lib/ai/types";
import { env } from "@/lib/env";
import { getEveConnectionOptions } from "./connection-options";
import { resolveWorkflowWorld } from "./world-config";

const assertEveConfigured = (): void => {
  if (
    !(
      typeof env.EVE_INTERNAL_ORIGIN === "string" &&
      env.EVE_INTERNAL_ORIGIN !== "" &&
      typeof env.EVE_GATEWAY_SECRET === "string" &&
      env.EVE_GATEWAY_SECRET !== "" &&
      (resolveWorkflowWorld(env) === "vercel" ||
        (typeof env.WORKFLOW_POSTGRES_URL === "string" &&
          env.WORKFLOW_POSTGRES_URL !== ""))
    )
  ) {
    throw new Error(
      "Configure the Eve origin, gateway secret and local workflow database (outside Vercel) before starting a conversation."
    );
  }
};

/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve eveRequest's awaited sequencing and rejected-Promise behavior. */
/* oxlint-disable max-params -- The exported request API accepts owner, path, request options and optional model/tool headers; existing callers depend on these positional arguments. */
const eveRequest = async (
  owner: string,
  path: string,

  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Forward native RequestInit unchanged except enforced headers/cache/redirect; Next.js requires mutable next.tags, which is rejected when projected deeply readonly.
  init: RequestInit = {},
  modelId?: string,
  selectedTool?: UiToolName
): Promise<Response> => {
  assertEveConfigured();
  const connection = getEveConnectionOptions(owner);
  const headers = new Headers({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing connection.headers own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...connection.headers,
    authorization: `Bearer ${connection.auth.bearer}`,
  });
  if (typeof modelId === "string" && modelId !== "") {
    headers.set("x-chatjs-model", modelId);
  }
  if (typeof selectedTool === "string") {
    headers.set("x-chatjs-tool", selectedTool);
  }

  // oxlint-disable-next-line typescript/strict-boolean-expressions -- BodyInit combines text, buffers and streams with null/undefined; retain no content-type for empty text or absent bodies. Explicit null comparisons also conflict with unicorn/no-null.
  if (init.body) {
    headers.set("content-type", "application/json");
  }
  return await fetch(new URL(path, connection.host), {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing init own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...init,
    cache: "no-store",
    headers,
    redirect: "error",
  });
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (assertEveConfigured, eveRequest); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable max-params */
export { assertEveConfigured, eveRequest };
/* oxlint-enable import/no-named-export */
