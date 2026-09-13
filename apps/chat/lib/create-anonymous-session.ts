import { ANONYMOUS_LIMITS } from "./types/anonymous";
import type { AnonymousSession } from "./types/anonymous";
import { generateUUID } from "./utils";

export const createAnonymousSession = (): AnonymousSession => {
  const id = generateUUID();
  const remainingCredits = ANONYMOUS_LIMITS.CREDITS;
  const createdAt = new Date();
  return { createdAt, id, remainingCredits };
};
