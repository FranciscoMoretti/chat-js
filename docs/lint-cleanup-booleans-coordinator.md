# Coordinator Boolean Audit

23 original memberships across 17 files removed; none retained. The JSON inventory remains authoritative for file/rule counts.

- Explicit nonempty-string checks preserve empty environment/cookie/caption behavior; optional DB rows now use undefined checks. Billing root session IDs retain null protection.
- Chat layout model selection moved to a small resolveDefaultModel helper after explicit conditions exposed complexity; valid cookie selection, anonymous fallback, and model ordering are unchanged.
- Policy pages preserve omitted empty dates and default currency. Two native browser cases exercise empty/nonempty dates and currency; inspected the 800px scrollable side-by-side capture.
- Video captions preserve null and empty behavior. Seventeen video unit tests passed; Remotion frame255 was rendered and inspected at /tmp/lint-threads-caption.png.
- Prototype branch logic passed20 tests against disposable local PostgreSQL. Registry chart readiness still waits for all present canvases and final animation state.
- Scoped type-aware lint passed; integrated validation is coordinated separately.

| File | Starting | Removed | Remaining |
| --- | --: | --: | --: |
| `apps/chat/agent/hooks/billing.ts` | 1 | 1 | 0 |
| `apps/chat/app/(chat)/api/files/upload/route.test.ts` | 1 | 1 | 0 |
| `apps/chat/app/(chat)/layout.tsx` | 1 | 1 | 0 |
| `apps/chat/app/(chat)/project/[projectId]/page.tsx` | 1 | 1 | 0 |
| `apps/chat/app/api/agent-conversations/[id]/checkpoint/route.ts` | 1 | 1 | 0 |
| `apps/chat/app/api/dev-login/route.ts` | 1 | 1 | 0 |
| `apps/chat/app/api/eve/[...path]/relay-response.ts` | 1 | 1 | 0 |
| `apps/chat/app/layout.tsx` | 1 | 1 | 0 |
| `apps/chat/app/privacy/page.tsx` | 1 | 1 | 0 |
| `apps/chat/app/terms/page.tsx` | 1 | 1 | 0 |
| `apps/chat/trpc/routers/eve.router.ts` | 4 | 4 | 0 |
| `apps/chat/trpc/routers/project.router.ts` | 4 | 4 | 0 |
| `apps/videos/src/threads-launch.tsx` | 1 | 1 | 0 |
| `packages/registry/visual/charts-finished.ts` | 1 | 1 | 0 |
| `packages/registry/visual/renderer.browser.test.tsx` | 1 | 1 | 0 |
| `prototypes/app-owned-branching/mock-provider.ts` | 1 | 1 | 0 |
| `prototypes/app-owned-branching/model.ts` | 1 | 1 | 0 |
