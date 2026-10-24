import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { env } from "@/lib/env";
import { runCleanupJob } from "@/lib/cleanup/job";

const HTTP_OK = 200;
const HTTP_SERVICE_UNAVAILABLE = 503;

/** Authenticate any deployment scheduler before running the shared cleanup job.
 * @param {ReadonlyNativeSurface<Pick<NextRequest, "headers">>} request Scheduler request.
 * @returns {Promise<NextResponse>} Task results, with a retryable status for incomplete work.
 */
export const GET = async (
  request: ReadonlyNativeSurface<Pick<NextRequest, "headers">>
): Promise<NextResponse> => {
  const authHeader = request.headers.get("authorization");
  const hasCronSecret = Boolean(env.CRON_SECRET?.trim());
  if (!hasCronSecret || authHeader !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await runCleanupJob();
  return NextResponse.json(result, {
    status: result.success ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE,
  });
};
