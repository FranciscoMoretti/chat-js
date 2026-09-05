# AI SDK 7 migration

This standalone upgrade targets main at `8422c767`. Main matched the R01/R07
research baseline before implementation. It preserves the existing database
schema, saved messages, thread topology, and demo configuration.

## Dependency and API boundary

Applications pin `ai 7.0.93`, `@ai-sdk/react 4.0.96`, and their provider-v4
companions. Thread peers start at the exact tested SDK/React releases. Node
>=22 is the SDK requirement; validation uses Node 24.20.0 and Bun 1.3.11.
No Eve dependencies or Eve runtime requirements are introduced.

Generation calls use instructions, isStepCount, onEnd/onStepEnd, and telemetry.
UI ChatInit/stream onFinish callbacks remain unchanged. Follow-up and research
compression context use responseMessages for the complete generated history.
Per-step research accounting stays per-step; main finish usage, eval usage,
compression/clarification/brief/report costs are aggregate. Report document lookup
intentionally searches aggregate tool results. Image generation has one step,
so aggregate usage/files retain its existing semantics.

The gateway seam returns provider-v4 models without model assertions. Removed
usage fields read the SDK's nested token details. Static and dynamic tool guards
remain distinct. MCP discovery returns only string descriptions; dynamic
functions require execution context and are not evaluated during discovery.
MCP HTTP/SSE redirect behavior retains SDK 7's error default.

Thread reconnects distinguish full replay (`start`) from a continuation. Full
replay replaces canonical content; a continuation seeds the canonical assistant
identity, metadata and parts into the fresh SDK response object. Null reconnects
retain prior errors. Restored tool updates use the same response state.

## Deliberate compatibility boundaries

- Files SDK remains on its optional SDK-6 peer. The application imports only
  its storage/file API; file-storage/content/URL/download tests exercise that
  boundary. Its unused AI adapter is **not** claimed compatible.
- Evalite's SDK-6 model wrapper is removed from the sample eval, including its
  double assertion. Evalite still runs the task/scorers; automatic wrapper traces
  are unavailable until Evalite supports provider v4.
- The supported deprecated result.toUIMessageStream helper remains in the
  existing streaming routes/pipeline. Moving to the stateless helper is separate
  integration work.
- @ai-sdk/otel's LegacyOpenTelemetry adapter preserves the existing span naming.
  It is supplied only to previously opted-in calls, without global registration.
  Devtools stays development-only middleware; no second telemetry integration is
  registered. Research correlation data moves to runtimeContext (SDK 7 context
  attributes). Langfuse export could not be verified without Langfuse credentials.
- Inline FileData and provider references pass through asset downloading.
  Unsupported reasoning-file/custom UI parts are explicitly rejected by the
  persistence mapper; they are not silently stored in the existing schema or
  interpreted as ordinary attachments. Existing saved parts remain unchanged.

## Validation

Validated on 2026-09-05 using Node 24.20.0, Bun 1.3.11, Next 16.3.0
(Turbopack), and agent-browser 0.36.0:

- `bun install --frozen-lockfile`, `bun lint`, and `bun test:types` passed.
- `bun test:unit`: 13 worktree checks, 34 CLI tests, 65 Thread tests, and
  145 chat tests passed. All original assertions are retained. Run types and
  unit checks sequentially: the packed-package test reads the dist directory
  that Thread's type-check script rebuilds.
- `bun test:e2e`: four Chromium page smoke tests passed on the restored default
  configuration. These are not live provider coverage.
- `bun template:sync` and `bun template:check` passed. Generated templates carry
  SDK 7 and the vendored Thread adapter; local devtools recordings are excluded.
- Browser: dev-login, real gpt-5-mini reasoning/text completion, wordCount
  execution (six words) and its custom renderer, retry into a sibling, and
  switching back to the original tool result passed.
- Browser: reload during generation reconnected through the Redis-backed
  `/api/chat/:id/stream?messageId=...` endpoint (HTTP 200) and completed with
  `RECOVERY_VERIFIED`. Saved history and branch content remained available.
- Browser: gpt-5-mini and gpt-5-nano ran concurrently. Stopping selected mini
  called the real stopStream mutation; nano remained generating and completed
  with `PARALLEL_VERIFIED`. Both persisted siblings remained selectable.
- Next MCP reported no compilation issues or runtime errors on the successful
  direct-provider journeys. The default gateway authentication error was also
  observed in the app's error UI.

The checked-in Vercel gateway credential returned Unauthorized. Successful live
journeys therefore used a temporary local `ai: { gateway: "openai" }` preset,
a freshly generated OpenAI catalog, the existing authorized OpenAI key, Postgres,
and Redis. The demo preset and generated catalog were restored exactly afterward.
No existing conversations were reset or migrated. Default-gateway live success
still needs a working gateway credential.

The app has no approve/deny action for tool approval; live approval UI coverage
is unavailable. Thread's controlled ownership/approval tests pass. Live MCP
connector/OAuth, deep research, media generation, and Langfuse export are not
claimed verified. Files SDK's unused AI adapter and Evalite's removed tracing
wrapper remain outside the validated boundary.

Contracts were checked against the [pinned SDK 7 migration guide](https://github.com/vercel/ai/blob/6359fd58fe68eaade096b5d923bac26de84ca3bd/content/docs/08-migration-guides/23-migration-guide-7-0.mdx)
and the installed releases' source and declarations.
