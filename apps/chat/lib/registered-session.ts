import type { Session } from "./auth";
import { env } from "./env";

export const getRegisteredSession = async (
  headers: Headers
): Promise<Session | null> => {
  if (env.CHATJS_GUEST_ONLY) {
    return null;
  }
  const { auth } = await import("./auth");
  return auth.api.getSession({ headers });
};
