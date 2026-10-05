import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { env } from "@/lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cleanupExpiredEveGuests } from "@/lib/eve/cleanup-expired-guests";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cleanupEveOrphanedFiles } from "@/lib/eve/cleanup-orphaned-files";
/* oxlint-enable sort-imports */

/* oxlint-disable no-magic-numbers --
 * no-magic-numbers (#517): ORPHANED_ATTACHMENTS_RETENTION_TIME uses 4, 60, 1000 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
// Four hours.
const ORPHANED_ATTACHMENTS_RETENTION_TIME = 4 * 60 * 60 * 1000;
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve GET's awaited sequencing and rejected-Promise behavior. */
/* oxlint-enable no-magic-numbers */

/* oxlint-disable no-console, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls --
 * no-console (#514): GET emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision.
 * no-magic-numbers (#517): GET uses 0, 200, 503 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 * typescript/explicit-function-return-type (#560): Keep GET's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep GET's return type inferred from its schema, SDK, or implementation result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): GET accepts request: NextRequest; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): GET intentionally keeps the existing falsy-value behavior of env.CRON_SECRET?.trim(); distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/max-nested-calls (#568): GET keeps its ordered workflow and input contract together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 */
export const GET = async (request: NextRequest) => {
  try {
    // Verify this is being called by Vercel cron
    const authHeader = request.headers.get("authorization");
    if (
      !env.CRON_SECRET?.trim() ||
      authHeader !== `Bearer ${env.CRON_SECRET}`
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [attachments, guests] = await Promise.allSettled([
      cleanupEveOrphanedFiles(
        new Date(Date.now() - ORPHANED_ATTACHMENTS_RETENTION_TIME)
      ),
      cleanupExpiredEveGuests(process.cwd()),
    ]);
    const success =
      attachments.status === "fulfilled" &&
      !attachments.value.skipped &&
      guests.status === "fulfilled" &&
      !guests.value.skipped &&
      guests.value.pendingCount === 0;
    return NextResponse.json(
      {
        results: {
          expiredGuests:
            guests.status === "fulfilled"
              ? guests.value
              : { error: "Guest cleanup failed; retry required." },
          orphanedAttachments:
            attachments.status === "fulfilled"
              ? attachments.value
              : { error: "Attachment cleanup failed; retry required." },
        },
        success,
        timestamp: new Date().toISOString(),
      },
      { status: success ? 200 : 503 }
    );
  } catch (error) {
    console.error("Cleanup cron job failed:", error);
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Cleanup failed",
      },
      { status: 500 }
    );
  }
};
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console, no-magic-numbers, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/max-nested-calls */
