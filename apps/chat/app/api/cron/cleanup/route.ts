import { type NextRequest, NextResponse } from "next/server";

import { config } from "@/lib/config";
import { getAllAttachmentUrls } from "@/lib/db/queries";
import { env } from "@/lib/env";
import { cleanupExpiredEveGuests } from "@/lib/eve/cleanup-expired-guests";
import { cleanupEveOrphanedFiles } from "@/lib/eve/cleanup-orphaned-files";
import { deleteFilesByUrls, listFiles } from "@/lib/file-storage";
import { isFileStorageKey, keyFromFileUrl } from "@/lib/file-url";

const ORPHANED_ATTACHMENTS_RETENTION_TIME = 4 * 60 * 60 * 1000; // 4 hours

export async function GET(request: NextRequest) {
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
      cleanupOrphanedAttachments(),
      cleanupExpiredEveGuests(process.cwd()),
    ]);
    const success =
      attachments.status === "fulfilled" &&
      guests.status === "fulfilled" &&
      guests.value.pendingCount === 0;
    return NextResponse.json(
      {
        success,
        timestamp: new Date().toISOString(),
        results: {
          orphanedAttachments:
            attachments.status === "fulfilled"
              ? attachments.value
              : { error: "Attachment cleanup failed; retry required." },
          expiredGuests:
            guests.status === "fulfilled"
              ? guests.value
              : { error: "Guest cleanup failed; retry required." },
        },
      },
      { status: success ? 200 : 503 }
    );
  } catch (error) {
    console.error("Cleanup cron job failed:", error);
    return NextResponse.json(
      {
        error: "Cleanup failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

async function cleanupOrphanedAttachments() {
  // Use EVE ownership even when admission is disabled; never infer its
  // references from legacy message rows or delete uninventoried legacy files.
  if (env.WORKFLOW_POSTGRES_URL) {
    return await cleanupEveOrphanedFiles(
      new Date(Date.now() - ORPHANED_ATTACHMENTS_RETENTION_TIME)
    );
  }
  // Skip cleanup if neither image tool nor attachments is enabled
  const imageGenerationEnabled = config.ai.tools.image.enabled;
  const attachmentsEnabled = config.features.attachments;
  if (!(imageGenerationEnabled || attachmentsEnabled)) {
    return { deletedCount: 0, deletedUrls: [], skipped: true };
  }

  try {
    const attachmentUrls = await getAllAttachmentUrls();
    const usedAttachmentKeys = new Set(
      attachmentUrls
        .map(keyFromFileUrl)
        .filter((key): key is string => key !== null)
    );

    // Get all files from the configured storage provider
    const { files } = await listFiles();

    // Find old files that are not referenced in any message
    const retentionCutoff = new Date(
      Date.now() - ORPHANED_ATTACHMENTS_RETENTION_TIME
    );
    const orphanedUrls: string[] = [];

    for (const file of files) {
      if (!isFileStorageKey(file.pathname)) {
        continue;
      }
      const fileDate = new Date(file.uploadedAt);
      const isOld = fileDate < retentionCutoff;
      const isUnused = !usedAttachmentKeys.has(file.pathname);

      if (isOld && isUnused) {
        orphanedUrls.push(file.url);
      }
    }

    // Delete orphaned attachments
    if (orphanedUrls.length > 0) {
      await deleteFilesByUrls(orphanedUrls);
      console.log(`Deleted ${orphanedUrls.length} orphaned attachments`);
    }

    return {
      deletedCount: orphanedUrls.length,
      deletedUrls: orphanedUrls,
    };
  } catch (error) {
    console.error("Failed to cleanup orphaned attachments:", error);
    throw error;
  }
}
