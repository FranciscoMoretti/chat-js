import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { env } from "@/lib/env";
import { cleanupExpiredEveGuests } from "@/lib/eve/cleanup-expired-guests";
import { cleanupEveOrphanedFiles } from "@/lib/eve/cleanup-orphaned-files";

// Four hours.
const ORPHANED_ATTACHMENTS_RETENTION_TIME = 4 * 60 * 60 * 1000;

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
      guests.status === "fulfilled" &&
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
