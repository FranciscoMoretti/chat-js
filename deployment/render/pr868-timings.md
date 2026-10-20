# Render timing investigation: 2026-10-20

Read-only analysis of the user's exact chat 93c09f25-55eb-4d8f-955a-24dcbc8cb8de. Source: Supabase workflow steps, persisted stream events, model usage receipts, and decoded final turn state. No new chat, service configuration change or code deployment was performed.

## Timeline (UTC)

- 07:21:10.334: chat/conversation database creation.
- 07:21:12.929: workflow run created.
- 07:21:13.675: workflow run started.
- 07:21:21.396–23.477: createSessionStep execution.
- 07:21:27.686: turnStep execution starts.
- 07:21:31.518: native turn.started event.
- 07:21:31.885: native model step.started event.
- 07:21:34.404–34.912: main provider attempt reported by AI Gateway (0.508 s; not end-to-end streaming duration).
- 07:21:36.081: first and second message.appended events, comprising the greeting.
- 07:21:36.980: message.completed.
- 07:21:37.912: first text persisted in stream storage.
- 07:21:41.499: turn.completed event produced.
- 07:21:42.228–43.110: follow-up suggestion provider attempt (0.882 s).
- 07:21:43.238: turn.completed persisted.
- 07:21:43.562: session.waiting event produced.
- 07:21:45.145: session.waiting persisted.
- 07:21:45.791: turnStep completed.

Durations: 21.551 s from chat creation to model-step event; 4.196 s from model-step event to first text; 1.831 s from first text event to stream persistence; 35.457 s from chat creation to workflow-step completion. Click-to-server admission and actual browser paint times are absent, so these are server-side timing boundaries, not browser measurements.

## Findings

- No tool calls in the captured event stream.
- Decoded final turn state has sandboxState.session = null: no JustBash sandbox started for this message.
- The main model used 1,915 input tokens and produced 11 output tokens. One successful provider attempt, no provider retry/fallback.
- A second model receipt is follow-up suggestion generation (85 input, 66 output tokens). It contributes after the answer, but cannot explain the large pre-answer delay.
- The largest measured segment is session/workflow setup before the model step. There are several multi-second gaps between persisted workflow transitions.
- The free service has 0.15 CPU, a two-connection workflow pool, and a one-connection application pool. CPU throttling, connection contention, and durable workflow dispatch are hypotheses for those gaps; this trace does not distinguish them. Queue code uses a 500 ms polling fallback, so attributing every multi-second gap solely to polling is unwarranted.
- Several events are persisted together, and event-to-storage lag ranges into multiple seconds. This affects perceived streaming independently of model generation.

Timestamp handling: workflow timestamp-without-time-zone fields were read as SQL text and interpreted as UTC. The local postgres-js Date conversion otherwise subtracts the machine's British Summer Time offset, producing a false one-hour discrepancy.

Next instrumentation should record elapsed durations around workflow enqueue/dispatch, database pool acquisition, session creation, model dispatch and stream flush, and sample process/event-loop/cgroup CPU usage during matched first-turn vs warm-follow-up requests. Keep optional follow-up work independent of input readiness, but prioritize the 21.6-second setup segment.
