import { env } from "../env";

/** Credentials for the app-to-EVE boundary, shared by HTTP and SDK clients. */
export const getEveConnectionOptions = (ownerId: string) => {
  const host = env.EVE_INTERNAL_ORIGIN ?? "";
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
  return { auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" }, headers, host };
};
