import { toNextJsHandler } from "better-auth/next-js";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { auth } from "@/lib/auth";
/* oxlint-disable import/no-named-export -- Framework discovery uses these named bindings (GET, POST); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable sort-imports */

export const { GET, POST } = toNextJsHandler(auth);
/* oxlint-enable import/no-named-export */
