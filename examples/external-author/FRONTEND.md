# Frontend-only author examples

Provisional against PR #318 commit
`1b47cffe692acb8e2ebaf1ebebfa7ec76df75f10`. These examples consume its existing
boundaries; they do not propose changes to the review branch.

`frontend-source/scratchpad.tsx` exports `Scratchpad`, an ordinary client component
with no required props. `frontend-source/studio-layout.tsx` exports `StudioLayout`,
which accepts `{ children: ReactNode }` and renders those children once. The layout
replaces the selected layout; the scratchpad is an independent functional addition
rendered above the conversation header. It is not a replacement composer.

## Standard registry item mapping

| Source | Explicit registry:file target | Composition metadata |
| --- | --- | --- |
| `frontend-source/scratchpad.tsx` | `~/components/author/scratchpad.tsx` | `components: [{ path: "./components/author/scratchpad", export: "Scratchpad" }]` |
| `frontend-source/studio-layout.tsx` | `~/components/author/studio-layout.tsx` | `provides: ["layout"]`, `layout: { path: "./components/author/studio-layout", export: "StudioLayout" }` |

Both items may declare `requires: ["next"]`. Remove `@chatjs/layout-minimal` from
the selection when selecting the external layout: two `layout` providers are an
error. The scratchpad declares no provider and does not compete with the layout.
The parent example harness packages these files as ordinary author-owned
`registry:item` entries and exercises the built installer against a disposable
local HTTP registry. No registry is published by this proof.

Dependency inventory: React is supplied by the selected Next.js base. These items
add zero npm dependencies, zero tool files, zero server imports and zero env vars.
The scratchpad imports only React hooks; the layout imports only a React type.
There is no model, Eve, database, search, credential or ChatJS runtime import.
The pinned installer imports frontend-only components eagerly into `chat.client.ts`;
these small examples do not claim lazy component installation or loading.

## Behavioral checks for the generated app

1. The page shows “Independent author studio” and the original conversation UI.
2. Open “Scratchpad”; type `Local draft`. The count becomes `11 characters` and
   “Clear notes” becomes enabled. Typing must not submit a turn or issue an API call.
3. Close and reopen the details panel: the draft remains. Click “Clear notes”:
   the textarea becomes empty and the button becomes disabled.
4. Reload: the draft resets. There is deliberately no persistence contract.
5. Chat submission, tool rendering and subsequent responses continue inside the
   layout. This requires the separate generated-app integration journey; shape
   compatibility alone does not establish it.

These are expected assertions for the harness, not a claim they already passed.
Type conformance should accept both exports and reject a frontend component with
a required `conversationId` prop or a layout requiring an additional `accountId`.
The actual generated consumer, not a new author-side interface, owns those checks.

## Unsupported boundaries at this pin

`app/chat.tsx` owns its message forms and conversation state directly. The installer
does not expose composer replacement, conversation view/action/lifecycle props,
toolbar slots or chat-state injection for frontend-only components. A no-props
component cannot infer those capabilities from its successful installation. A
custom base or deliberate developer-owned source edits could change that, but
this example does neither and has no P2 dependency.

The current layout contract promises only children composition. It does not
promise access to conversation identity, send/cancel actions, the Eve store or
ACL policy. Behavioral tests must check child rendering and preserved interactions
separately from TypeScript assignability.

Evidence at the pinned commit: `packages/cli/README.md` (external registry contract),
`packages/cli/src/selection/install.ts` (generated component and layout imports),
`packages/cli/src/selection/registry.ts` (exclusive providers),
`examples/minimal-next/app/chat.tsx` (no-props components and owned forms), and
`examples/minimal-next/components/chat/layout-minimal.tsx` (children contract).
