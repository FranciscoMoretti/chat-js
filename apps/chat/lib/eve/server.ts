import { env } from "@/lib/env";
import type { UiToolName } from "../ai/types";

export function assertEveConfigured() {
  if (
    !(
      env.EVE_INTERNAL_ORIGIN &&
      env.EVE_GATEWAY_SECRET &&
      env.WORKFLOW_POSTGRES_URL
    )
  ) {
    throw new Error(
      "Configure the Eve worker, secret and World database before starting a conversation."
    );
  }
}

export async function eveRequest(
  owner: string,
  path: string,
  init: RequestInit = {},
  modelId?: string,
  selectedTool?: UiToolName
) {
  assertEveConfigured();
  const headers = new Headers({
    authorization: `Bearer ${env.EVE_GATEWAY_SECRET}`,
    "x-chatjs-owner": owner,
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
  return await fetch(new URL(path, env.EVE_INTERNAL_ORIGIN), {
    ...init,
    headers,
    redirect: "error",
    cache: "no-store",
  });
}
