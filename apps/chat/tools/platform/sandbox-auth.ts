import { getVercelOidcToken } from "@vercel/oidc";

import { env } from "@/lib/env";

export interface SandboxAuth {
  projectId: string;
  teamId: string;
  token: string;
}

function claims(token: string) {
  let payload: unknown;
  try {
    payload = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8")
    );
  } catch {
    return undefined;
  }
  if (
    !(
      payload &&
      typeof payload === "object" &&
      "owner_id" in payload &&
      payload.owner_id
    )
  ) {
    return undefined;
  }
  // The SDK treats a truthy owner_id as JWT scope, even when other claims are
  // malformed. Never let that override an explicitly configured account silently.
  if (
    typeof payload.owner_id !== "string" ||
    !("project_id" in payload) ||
    typeof payload.project_id !== "string" ||
    !payload.project_id
  ) {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  return { teamId: payload.owner_id, projectId: payload.project_id };
}

/** Pin the same account coordinates for allocation intent and the SDK call. */
export async function resolveSandboxAuth(): Promise<SandboxAuth> {
  if (env.VERCEL_TEAM_ID && env.VERCEL_PROJECT_ID && env.VERCEL_TOKEN) {
    const identity = claims(env.VERCEL_TOKEN);
    if (
      identity &&
      (identity.teamId !== env.VERCEL_TEAM_ID ||
        identity.projectId !== env.VERCEL_PROJECT_ID)
    ) {
      throw new Error(
        "Sandbox token and configured provider scope do not match."
      );
    }
    return {
      teamId: env.VERCEL_TEAM_ID,
      projectId: env.VERCEL_PROJECT_ID,
      token: env.VERCEL_TOKEN,
    };
  }
  const token = await getVercelOidcToken();
  const identity = claims(token);
  if (!identity) {
    throw new Error("Sandbox provider identity is unavailable.");
  }
  // Decoding selects scope; Vercel still validates the token on every request.
  return { ...identity, token };
}
