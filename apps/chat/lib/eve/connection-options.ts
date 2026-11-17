import { env } from "@/lib/env";
import { getVercelOidcTokenSync } from "@vercel/oidc";

/**
 * Credentials for the app-to-EVE boundary, shared by HTTP and SDK clients.
 * @param {string} ownerId Owner identity sent to the trusted EVE gateway.
 * @param {string} host Gateway URL whose origin determines eligibility for deployment authentication.
 * @returns {{ auth: { bearer: string }; headers: Record<string, string>; baseUrl: string; redirect: "error"; }} Gateway credentials and owner headers, with project identity restricted to this deployment.
 */
export const getEveConnectionOptions = (
  ownerId: string,
  host = new URL("/eve/chat", env.EVE_INTERNAL_ORIGIN).href
): {
  auth: { bearer: string };
  headers: Record<string, string>;
  baseUrl: string;
  redirect: "error";
} => {
  const headers: Record<string, string> = { "x-chatjs-owner": ownerId };
  // A separate worker must never receive this Vercel project's credential.
  const sameDeployment =
    host !== "" &&
    [env.VERCEL_URL, env.VERCEL_BRANCH_URL].some(
      (hostname) =>
        typeof hostname === "string" &&
        hostname !== "" &&
        new URL(host).origin === `https://${hostname}`
    );
  if (sameDeployment && env.VERCEL === "1") {
    // Read the current invocation's identity each time; do not cache a token or
    // require a separately provisioned, long-lived deployment bypass secret.
    headers["x-vercel-trusted-oidc-idp-token"] = getVercelOidcTokenSync();
  }
  return {
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers,
    baseUrl: host,
    redirect: "error",
  };
};
