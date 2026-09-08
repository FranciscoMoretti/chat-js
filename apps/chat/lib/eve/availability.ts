import { env } from "@/lib/env";

// Billing, branch seeding and production admission are later migration gates.
export function isEveEnabled() {
  return env.NODE_ENV === "development" && env.EVE_ENABLED === "true";
}
