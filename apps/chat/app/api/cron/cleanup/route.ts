import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { env } from "@/lib/env";
import { runCleanupJob } from "@/lib/cleanup/job";

export const maxDuration = 300;
const MAX_BATCHES = 20;
const DRAIN_BUDGET_MS = 120_000;
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
  const deadline = Date.now() + DRAIN_BUDGET_MS;
  let result = await runCleanupJob();
  for (
    let batch = 1;
    batch < MAX_BATCHES && !result.success && Date.now() < deadline;
    batch += 1
  ) {
    const progress = Object.values(result.results).some(
      (task) =>
        !("error" in task) &&
        !task.skipped &&
        task.deletedCount + (task.retiredCount ?? 0) > 0
    );
    if (!progress) {
      break;
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- Drain successful batches serially within the scheduler budget.
    result = await runCleanupJob();
  }
  return NextResponse.json(result, {
    status: result.success ? HTTP_OK : HTTP_SERVICE_UNAVAILABLE,
  });
};
