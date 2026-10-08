import { env } from "@/lib/env";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (getEveConnectionOptions); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
    host !== "" &&
    [env.VERCEL_URL, env.VERCEL_BRANCH_URL].some(
      (hostname) =>
        typeof hostname === "string" &&
        hostname !== "" &&
        new URL(host).origin === `https://${hostname}`
    );
  if (sameDeployment) {
    const bypassSecret = env.VERCEL_AUTOMATION_BYPASS_SECRET;
    if (typeof bypassSecret === "string" && bypassSecret !== "") {
      headers["x-vercel-protection-bypass"] = bypassSecret;
    }
  }
  return {
    auth: { bearer: env.EVE_GATEWAY_SECRET ?? "" },
    headers,
    host,
    redirect: "error",
  };
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
