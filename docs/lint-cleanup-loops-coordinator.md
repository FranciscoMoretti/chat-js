# Await In Loops: Registry And Remaining Apps

All 32 original memberships outside delegated libraries, tests, and shared packages/scripts were reviewed. Seven were removed by parameterizing independent test cases. Twenty-five original memberships require ordered work; narrowing three broad directives expands them into twelve local directives. Current comment counts therefore differ from original audited membership counts.

| File or canonical source (installed copies included) | Original | Removed | Retained original | Evidence |
| --- | --: | --: | --: | --- |
| apps/chat/app/(chat)/api/files/upload/route.test.ts | 1 | 1 | 0 | Separate invalid file cases, each with reset mocks; parameterized tests preserve pre-storage assertions. |
| apps/chat/app/api/agent-conversation-copies/route.test.ts | 1 | 1 | 0 | Independent invalid request bodies, now parameterized with all rejection assertions. |
| apps/chat/proxy.test.ts | 1 | 1 | 0 | Independent protected URLs, now separate reset-isolated cases. |
| packages/registry/src/gateways/responses.test.ts | 4 | 4 | 0 | Adapter/body matrix now parameterized; all 29 cases and 30 assertions pass. |
| apps/chat/app/api/agent-conversation-copies/route.ts | 1 | 0 | 1 | Reader byte limit must be checked before requesting the next chunk; finally cancels and releases the lock. |
| apps/chat/instrumentation.ts | 1 | 0 | 1 | Installed registration order is observable, including preventing later registrations after a failed registrar. Core lifecycle starts first. |
| apps/chat/scripts/backfill-eve-search.ts | 1 | 0 | 1 | Cursor depends on completed batch; one snapshot is loaded/indexed at a time. Narrowed into two sites. |
| apps/electron/src/main.ts | 2 | 0 | 2 | Cookie/session polling reads, checks readiness, then delays before the next attempt. |
| apps/site/components/thread-playground-model.ts | 1 | 0 | 1 | Each token is emitted after its own cancellable delay; parallel delays change streaming cadence and cancellation. |
| apps/videos/scripts/stills.ts | 2 | 0 | 2 | Bounded renderer memory and ordered seek test; compare a repeated frame only after rendering it. |
| packages/registry/scripts/demo-sync.ts | 7 | 0 | 7 | Stage fully before ordered replacement; baseline commits last. Reverse rollback observes completed flags. Sequential staging prevents unfinished work racing cleanup after failure. |
| packages/registry/src/features/attachment-uploads/features/attachment-uploads/integration.tsx + apps/chat/features/attachment-uploads/integration.tsx | 2 | 0 | 2 | One upload at a time, increment admitted count and emit onUploaded in input order, release lock in finally. |
| packages/registry/src/features/attachment-uploads/features/attachment-uploads/upload-prep.ts + apps/chat/features/attachment-uploads/upload-prep.ts | 2 | 0 | 2 | One image compressor/worker and image bytes in memory at a time; preserve input order in prepared/rejected arrays. |
| packages/registry/src/features/mcp/lib/eve/mcp-tools.ts + apps/chat/lib/eve/mcp-tools.ts | 4 | 0 | 4 | Connector-scoped client lifecycle and bounded discovery time; inspect abort status before each schema and close before the next connector. |
| packages/registry/src/tools/deep-research/workflow.ts + apps/chat/tools/chatjs/deep-research/workflow.ts | 2 | 0 | 2 | Adaptive decisions consume prior compressed notes. Each topic publishes ordered progress/evidence; failure or cancellation prevents starting later topics. Narrowed into five sites per copy. |

Verification: focused type-aware lint passes for changed parameterized tests; gateway matrix 29 tests, file/copy routes 20 tests, proxy 11 tests. Canonical research changes are comment-only and installed copies are regenerated via demo sync. Prototype first-rule helper tests also passed all 20 local PostgreSQL cases. Repository unit task passed all nine Turbo tasks at this checkpoint; this does not substitute for later integration verification after further edits.
