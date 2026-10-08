import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { env } from "@/lib/env";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cleanupExpiredEveGuests } from "@/lib/eve/cleanup-expired-guests";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { cleanupEveOrphanedFiles } from "@/lib/eve/cleanup-orphaned-files";

/* oxlint-enable sort-imports */

const NO_PENDING_GUESTS = 0;
const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

// Four hours.
const ORPHANED_ATTACHMENTS_RETENTION_TIME = 14_400_000;
const cleanupResponse = (
  attachments: ReadonlyNativeSurface<
    PromiseSettledResult<Awaited<ReturnType<typeof cleanupEveOrphanedFiles>>>
  >,
  guests: ReadonlyNativeSurface<
    PromiseSettledResult<Awaited<ReturnType<typeof cleanupExpiredEveGuests>>>
  >
): NextResponse<{
  results: {
    expiredGuests:
      | Awaited<ReturnType<typeof cleanupExpiredEveGuests>>
      | { error: string };
    orphanedAttachments:
      | Awaited<ReturnType<typeof cleanupEveOrphanedFiles>>
      | { error: string };
  };
  success: boolean;
  timestamp: string;
}> => {
  const success =
    attachments.status === "fulfilled" &&
    !attachments.value.skipped &&
    guests.status === "fulfilled" &&
    !guests.value.skipped &&
    guests.value.pendingCount === NO_PENDING_GUESTS;
  return NextResponse.json(
    {
      results: {
        expiredGuests:
          // oxlint-disable-next-line no-ternary -- Keep expiredGuests as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          guests.status === "fulfilled"
            ? guests.value
            : { error: "Guest cleanup failed; retry required." },
        orphanedAttachments:
          // oxlint-disable-next-line no-ternary -- Keep orphanedAttachments as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          attachments.status === "fulfilled"
            ? attachments.value
            : { error: "Attachment cleanup failed; retry required." },
      },
      success,
      timestamp: new Date().toISOString(),
    },
    // oxlint-disable-next-line no-ternary -- Keep status as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    { status: success ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE }
  );
};

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Framework discovery uses these named bindings (GET); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve GET's awaited sequencing and rejected-Promise behavior. */

/* oxlint-disable no-console -- no-console (#514): GET emits operational command/error diagnostics through console; selecting another logging transport requires a runtime-specific decision. */

export const GET = async (
  request: ReadonlyNativeSurface<Pick<NextRequest, "headers">>
): Promise<
  | ReturnType<typeof cleanupResponse>
  | NextResponse<{ error: string }>
  | NextResponse<{ details: string; error: string }>
> => {
  try {
    // Verify this is being called by Vercel cron
    const authHeader = request.headers.get("authorization");
    // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the optional secret trim and its single receiver evaluation.
    const hasCronSecret = Boolean(env.CRON_SECRET?.trim());
    if (!hasCronSecret || authHeader !== `Bearer ${env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const attachmentCutoff = new Date(
      Date.now() - ORPHANED_ATTACHMENTS_RETENTION_TIME
    );
    const [attachments, guests] = await Promise.allSettled([
      cleanupEveOrphanedFiles(attachmentCutoff),
      cleanupExpiredEveGuests(process.cwd()),
    ]);
    return cleanupResponse(attachments, guests);
  } catch (error) {
    console.error("Cleanup cron job failed:", error);
    return NextResponse.json(
      {
        // oxlint-disable-next-line no-ternary -- Keep details as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Cleanup failed",
      },
      { status: 500 }
    );
  }
};
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable oxc/no-async-await */
/* oxlint-enable no-console */
