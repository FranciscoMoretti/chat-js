# M04 follow-up: direct JSX with functional components

Status: recommended simplification after Francisco challenged the component factory. This supersedes the `createChatUI(...).App/View` proposal in the initial report, not the already approved scope ownership. No production changes or final API commitment.

## Conclusion

Yes: directly imported components can connect to scoped Zustand stores and React Query through ordinary hooks. A central object that manufactures, registers or selects React components is unnecessary for the source-installed ChatJS model. Keep ordinary React providers for shared state identity and lifetime. Keep application/server configuration where it is actually needed, independently of the component composition.

The factory in the original exploration was intended to bind service defaults and generic project types. Neither requires a factory that returns components. Project-local modules already fix those types at compile time; normal providers/hooks already make integration available at runtime. The extra public setup interface did not establish a necessary benefit for the requested composition model.

## Intended consumer experience

Illustrative production names, exercised in a smaller form by the fixture:

```tsx
import { ConversationView } from "@/components/chat/conversation-view";
import { Messages } from "@/components/chat/messages";
import { Composer } from "@/components/chat/composer";
import { ModelPicker } from "@/components/chat/model-picker";
import { AttachmentPicker } from "@/components/chat/attachment-picker";

<ConversationView id="left" conversationId={id}>
  <Messages />
  <Composer>
    <ModelPicker />
    <AttachmentPicker />
    <ComposerSubmit />
  </Composer>
</ConversationView>
```

Remove `ModelPicker` from JSX and the composer still sends using its selected/default model. Add it elsewhere under the same view and it edits that view's selection. No `components: { ModelPicker }`, capability-enabling registration call or `chat.ModelPicker` namespace is needed. `Composer`'s internal hooks own send, validation, pending/error and invalidation; `AttachmentPicker` includes its upload workflow. The example's nested submit/attachment composition is a proposal, not implemented by the narrower fixture.

A third-party functional component imports the same public hooks and can be placed directly in that subtree. Installation supplies its source/dependencies first, just as for shadcn. The consumer need not register it in a UI factory. Distinct protocols it actually needs (for example a custom backend operation) still require an installed implementation; React placement cannot create an absent backend.

Two views of the same conversation:

```tsx
<Workspace>
  <ConversationView id="left" conversationId={id}>
    <Messages />
    <Composer />
  </ConversationView>
  <ConversationView id="right" conversationId={id}>
    <Messages />
    <ExternalComposer />
  </ConversationView>
  <DocumentPanel />
</Workspace>
```

App-level Query/runtime providers can live once in the existing host layout. Workspace is only needed for workspace behavior. ConversationView identifies the intended view, so a shared hook selects the nearest store instead of an implicit global singleton. A Message scope or explicit message identity similarly binds independently placed action buttons. The provider does not inspect children, discover component types, auto-register capabilities or cancel execution when a child disappears.

## Concrete internals

```tsx
// messages.tsx
export function Messages() {
  const conversationId = useConversationView(s => s.conversationId);
  const query = useQuery(chatMessagesOptions(conversationId));
  // Functional loading/error/rendering, with the view's selected path.
}

// model-picker.tsx
export function ModelPicker() {
  const selected = useConversationView(s => s.model);
  const setModel = useSetModel();
  const catalog = useQuery(modelCatalogOptions());
  // Existing shadcn/AI Elements control bound to these values.
}
```

Production execution snapshots should still come from the shared runtime/Eve subscription; this query example does not suggest copying authoritative execution into a separately mutable Query transcript. Query owns application resources such as catalogs/history metadata/documents. Zustand owns view state. The transport adapter owns execution attachment. Components may combine their hooks without exposing that orchestration to each consumer.

Direct connection does not require copying fetch/mutation implementations into every button. Small internal hooks can own query keys, schema validation, error handling and invalidation. They may call current tRPC directly. Add an adapter only at actual variation points, such as Next vs a custom host transport. Do not require every component to implement a universal `Services` interface.

## Inference without a factory

Existing source evidence at `18db694b`:

- `apps/chat/trpc/react.tsx` specializes `createTRPCContext<AppRouter>()` once and exports ordinary `useTRPC` hooks. Component consumers do not need generic setup objects.
- `apps/chat/lib/ai/app-model-id.ts` derives model types from local configuration; `lib/ai/installed-tools.ts` derives installed tool input/output from local registration. Current closed gateway map needs its separately planned external expansion, but compile-time local specialization does not require a UI factory.
- `apps/chat/lib/stores/custom-store-provider.tsx` already exposes scoped hooks. Its generic consumer cast should not be copied into the proposed typed binding. A local concrete `ViewState`/message projection can type context accurately without letting callers assert arbitrary message types.

The follow-up fixture imports a local catalog and derives `ModelId`. Both a direct ModelPicker hook and an external composer use that type without a factory. TypeScript rejects an uninstalled model. An external selected catalog can replace the local module and propagate its inferred types. No new global module augmentation or closed provider union is needed for this mechanism.

A different problem is a single published generic package that must host independently typed applications at runtime. That can justify typed bindings or explicit generic controllers. We do not need to impose that interface on the current source-installed project. Ordinary instances can select different models/conversations without becoming different TypeScript applications.

## What remains explicit

| Concern | Proposed handling |
|---|---|
| Add/remove UI | Direct source import and JSX placement; no second UI selection registry |
| Default settings | Existing/local configuration or component/provider defaults; independent of rendering |
| Independent drafts/selections | View-scoped Zustand provider; shared hooks read nearest provider |
| Queries | Existing Query/tRPC provider; functional hooks own integration and cache behavior |
| Runtime lifetime | Existing app-level conversation/session registry; components subscribe, not own execution |
| Host portability | Replace concrete local transport/navigation/file modules or use targeted provider overrides where runtime variation is needed |
| External functional component | Source-installed component importing public hooks; installs any additional prerequisites |
| Tool execution/renderer dispatch | Backend tool registration and mounted-name renderer lookup still needed: tools arrive as data, not as JSX chosen by the developer |
| Lazy heavyweight renderer | Optional local dynamic import keyed to actual tool/document type; removing a visible control does not automatically unload an existing execution |
| Install omission | Installer materializes selected source/dependencies. JSX removal stops rendering; it does not uninstall npm packages or remove files |

The install distinction is the same practical distinction as shadcn: source can be installed but unused. Remove the JSX and unused import to stop referencing it. Omission from a generated app must separately omit exclusive source/dependencies. Do not implement arbitrary JSX scanning and dependency pruning to make a removed tag silently alter backend availability.

Some pieces require an enclosing scope or service, like a shadcn DialogTrigger needs its root. This is compatible with direct JSX composition. Missing required scope should produce a clear error; it should not silently create a second runtime, share a global draft, or invent a backend.

## Executable evidence

[Fixture](m04-jsx-spike/README.md) uses React 19.2.3, React DOM, Zustand 5.0.12, TanStack Query 5.97.0, Zod and the existing lockfile. Compiled by Bun and rendered in headless installed Chrome through Playwright against an ephemeral loopback recording API.

Observed:

- Two mounted ConversationView providers, both displaying the same conversation: one initial message query.
- Independent draft fields; selecting Careful in the left view does not affect the right default Fast.
- ModelPicker removed from JSX at runtime: no model control remains; left draft and chosen model survive; Composer still submits.
- Left send invalidates the shared query and both lists update; right draft is preserved.
- Right view, with no model picker, sends using Fast.
- Separately authored ExternalComposer imports hooks and sends into the right view with no factory/registration.
- Three submissions total; four query reads total (initial plus one refresh per mutation); zero page errors.
- Standalone TypeScript check passes including negative model-ID cases.

This is a React mounting, context, query/mutation and typing proof. The API is a recording fixture with no real model/Eve/auth/storage. It does not establish streaming runtime lifetime, actual external installation, conditional dependency omission, attachment behavior or production-ready race handling. Earlier M04 headless tests cover some asynchronous invariants; mounted acceptance still needs that integration.

## Updated recommendation

Remove the public component factory from the normal path. Export direct functional components and hooks, use ordinary scope providers, and retain installed working defaults. Keep integration helpers internal or capability-specific until a real second integration needs an override. Do not build a generic UI registry or duplicate shadcn/AI Elements primitives.

The next useful spike is to adapt one existing Messages/Composer pair to this plain provider shape and the accepted runtime seam, then mount it twice. The whole UI does not need rewriting to validate that direction. Production extraction still follows the requested discussion before commitment.
