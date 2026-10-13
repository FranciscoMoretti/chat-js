import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { env } from "@/lib/env";
import { cleanupExpiredEveGuests } from "@/lib/eve/cleanup-expired-guests";
import { cleanupEveOrphanedFiles } from "@/lib/eve/cleanup-orphaned-files";

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
    { status: success ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE }
  );
};

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
        details: error instanceof Error ? error.message : "Unknown error",
        error: "Cleanup failed",
      },
      { status: 500 }
    );
  }
};
