# ChatJS cleanup job

Cleanup belongs to the application. Deployment providers schedule the same authenticated `GET /api/cron/cleanup` job; they do not implement retention or deletion themselves.

`lib/cleanup/job.ts` coordinates independent tasks and reports each task's result. It currently cleans up expired legacy guest families, expired shared-runtime guest sessions, and orphaned attachments older than four hours. Registered conversation history is not an expiration target. Add future cleanup tasks here, with their ownership checks, retention policy, retry behavior and tests in their own module.

The tasks retain their existing database claims, ownership fences and idempotent deletion receipts. Guest deletion runs in bounded batches. Attachment deletion uses batches of 100, but inventory traversal can still span the entire bucket; this is not a globally time-bounded job. Failed or uncertain deletions remain retryable. A scheduler must not infer success from dispatching a request: `200` means all tasks completed without pending work, while `503` means incomplete work needs another attempt. Individual failures do not prevent the other tasks from running. Responses contain counts and safe errors, never raw provider exceptions.

## Scheduling adapters

| Deployment | How to invoke the shared job |
| --- | --- |
| Vercel | `apps/chat/vercel.json` configures Vercel Cron to call the route. Set `CRON_SECRET` on the deployment. |
| Render | The `chatjs-cleanup` cron service in `deployment/render/render.yaml` runs `apps/chat/scripts/cleanup.ts` hourly. Set the web service's public `APP_URL` and the same `CRON_SECRET`. Creating the cron service is separate from deploying the web service. |
| Other self-hosting | Run `bun run cleanup` from the repository root (or from a generated app) using system cron, a container scheduler or Kubernetes CronJob. Provide `APP_URL` and `CRON_SECRET` through the scheduler's secret environment, not command-line arguments. |

The hosted runner requires HTTPS, refuses redirects, drains successful guest batches, and exits nonzero on failed or stalled work. Its two-minute deadline bounds the client wait; it does not cancel work already running on the server. Avoid overlapping schedules; database ownership protections make retries safe, but there is no global scheduler lock. Use the scheduler's single-concurrency setting where available and alert on unsuccessful runs.

The checked-in Vercel schedule is daily for Hobby compatibility; Render's is hourly. Guests become eligible for deletion at 24 hours. Physical deletion follows on a successful scheduled sweep, so a daily schedule can approach 48 hours and an hourly schedule 25 hours, plus failures/backlog. Neither is a strict 24-hour erasure guarantee. Choose a schedule that matches the deployment's advertised retention policy.

Verify a deployment by running `bun run cleanup` with its environment and checking both the exit status and protected application logs. To certify retention, also test an expired guest with real workflow data and confirm provider payload deletion while a registered conversation remains available. A successful empty sweep alone does not certify erasure.
