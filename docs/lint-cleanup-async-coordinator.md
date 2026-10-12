# Promise Function Async: Registry And Adapters

All 47 baseline memberships outside the three delegated areas and UI/site were reviewed and removed. Original identities are the file/line entries in `lint-cleanup-baseline.json`; current per-file counts are in `lint-cleanup-current.json`.

## Changes And Evidence

- Registry tool execution and approval callbacks await existing operations. MCP `withAbort` already awaits/races operation results inside its error boundary. Client close is still cached before awaiting, so cancellation and final cleanup invoke the underlying close once. MCP unit tests cover aborted discovery, approval, execution and client cleanup.
- Upload callbacks await storage inside the existing ownership reservation. Controlled gate tests still prove no storage starts before reservation.
- Sandbox creation is awaited at every call site, and its token helper only constructs an object. Provider errors remain observable by the surrounding execution catch. Cancellation mocks await genuine deferred operations; their synchronous side effects still run before the await.
- Next dynamic loaders await the literal import and select the same export. Imports stay inside top-level `dynamic` calls with the same SSR/loading options, matching the installed Next docs. This also removes four `prefer-await-to-then` memberships in canonical sources and four installed copies. Browser assertions and an inspected screenshot show saved text, code and sheets; comparison loading remains configured identically.
- Next `after` callbacks await title persistence. tRPC fetch, middleware, and resolver adapters await their operations. Installed tRPC `callRecursive` awaits middleware inside try/catch, so authorization errors keep the same procedure error handling. EVE's installed `dispatchDynamicModelEvent` also awaits the guest model callback inside its error boundary.
- React Query settlement awaits invalidation. IPC preload adapters await `invoke` with an explicit unknown result type, matching the untyped IPC payload boundary. Cookie operations remain concurrent within Promise.all.
- Docs image decode, registry cleanup, module-mocking, and prototype helpers await actual operations. Upload gate mocks use `mockReturnValue`, preserving their precise pending promise without a callback.
- Coordinator follow-up removes the library health and app-private fetch adapter exceptions. Health callers consume completion, not promise identity; two new tests prove shared-query deduplication and retry after rejection.

## Verification

- Type-aware Oxlint of all coordinator-owned application, registry, docs and Electron files passed before the subsequent loop test edits.
- MCP/upload/code execution focused tests: 47 passed.
- File routes, development login, MCP registration and creation: 32 passed.
- Image and sandbox execution/cancellation tests: 31 passed.
- Health deduplication/retry tests: 2 passed.
- Installed document browser tests: 3 passed; screenshot inspected at `/tmp/lint-cleanup-installed-document-bundles.png`.
- Demo synchronization regenerated installed copies and baseline centrally.
- Repository-wide checks are recorded separately in the main audit; focused passes are not a claim of completed repository validation.
