import { env } from "@/lib/env";

// Billing, branch seeding and production admission are later migration gates.
// Billing, branch seeding and production admission are later migration gates.
export const isEveEnabled = () =>
  env.NODE_ENV === "development" && env.EVE_ENABLED === "true";
