import { toNextJsHandler } from "better-auth/next-js";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { auth } from "@/lib/auth";
/* oxlint-enable sort-imports */

export const { GET, POST } = toNextJsHandler(auth);
