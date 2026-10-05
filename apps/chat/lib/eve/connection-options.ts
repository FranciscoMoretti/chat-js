import { env } from "@/lib/env";

/* oxlint-disable typescript/strict-boolean-expressions --
 * typescript/strict-boolean-expressions (#610): getEveConnectionOptions intentionally keeps the existing falsy-value behavior of [env.VERCEL_URL, env.VERCEL_BRANCH_URL].some( (hostname) => hostname && new URL(host); hostname; sameDeployment; env.VERCEL_AUTOMATION_BYPASS_SECRET; distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/**
 * Credentials for the app-to-EVE boundary, shared by HTTP and SDK clients.
 * @param {string} ownerId Owner identity sent to the trusted EVE gateway.
 * @param {string} host Gateway URL whose origin determines eligibility for deployment protection bypass.
 * @returns {{ auth: { bearer: string }; headers: Record<string, string>; host: string; redirect: "error"; }} Gateway credentials and owner headers, with deployment bypass restricted to this deployment.
 */
export const getEveConnectionOptions = (
  ownerId: string,
  host = new URL("/eve/chat", env.EVE_INTERNAL_ORIGIN).href
): {
  auth: { bearer: string };
  headers: Record<string, string>;
  host: string;
  redirect: "error";
} => {
  const headers: Record<string, string> = { "x-chatjs-owner": ownerId };
  // A separate worker must never receive this Vercel project's credential.
  const sameDeployment =
    host &&
    [env.VERCEL_URL, env.VERCEL_BRANCH_URL].some(
      (hostname) => hostname && new URL(host).origin === `https://${hostname}`
    );
  if (sameDeployment && env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }
  return {
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers,
    host,
    redirect: "error" as const,
  };
};
/* oxlint-enable typescript/strict-boolean-expressions */
