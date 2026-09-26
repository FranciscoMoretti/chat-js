import { env } from "@/lib/env";

import type { UiToolName } from "../ai/types";
import { getEveConnectionOptions } from "./connection-options";

export const assertEveConfigured = () => {
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
};

export const eveRequest = async (
  owner: string,
  path: string,
  init: RequestInit = {},
  modelId?: string,
  selectedTool?: UiToolName
) => {
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
