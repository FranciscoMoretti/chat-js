import type { CleanupTask } from "@/lib/cleanup/contracts";
import { cleanupGuestRuntimeSessions } from "./guest-cleanup";

export const guestCleanup = {
  id: "guest-chat",
  run: cleanupGuestRuntimeSessions,
} satisfies CleanupTask;
