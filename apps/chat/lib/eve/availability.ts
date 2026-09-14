import { env } from "@/lib/env";

// Production cutover remains gated on release review.
export const isEveEnabled = () =>
  env.NODE_ENV === "development" && env.EVE_ENABLED === "true";
