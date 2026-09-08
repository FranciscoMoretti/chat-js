import { env } from "@/lib/env";

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
  init: RequestInit = {}
) {
  assertEveConfigured();
  const headers = new Headers({
    authorization: `Bearer ${env.EVE_GATEWAY_SECRET}`,
    "x-chatjs-owner": owner,
  });
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
