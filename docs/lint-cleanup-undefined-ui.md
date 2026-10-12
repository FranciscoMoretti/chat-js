# UI unicorn/no-useless-undefined audit

14 original memberships (11 chat UI, 3 site): removed5, retained9, unresolved0. All owned original sites were inspected. No config, dependency, API-signature or sentinel changes were made to hide required arguments. Updated after storage snapshot migrations and explicit effect cleanup annotations.

| File | Starting | Removed | Retained | Concrete evidence |
| --- | --: | --: | --: | --- |
| apps/chat/components/eve/eve-artifact-layout.tsx | 2 | 0 | 2 | selectRevision requires revisionId:string\|undefined; the two live-version actions pass undefined and setSelectedRevisionId sets followLive based specifically on revisionId===undefined. |
| apps/chat/components/eve/eve-document-assistant-actions.tsx | 1 | 0 | 1 | useRef timer starts uninitialized; effect clears closeTimer.current on unmount. React types require initialValue, no zero-argument overload. |
| apps/chat/components/eve/eve-document-tool.tsx | 1 | 0 | 1 | Required useRef initial argument tracks previously observed document state; undefined means no prior document, not null. |
| apps/chat/components/eve/eve-history-list.tsx | 1 | 0 | 1 | Required useRef initial argument titlePollStartedAt begins with no polling timestamp; hasPendingTitle effect starts/resets it. Existing eve-history browser fixture exercises pending title lifecycle. |
| apps/chat/components/eve/use-document-draft.ts | 2 | 1 | 1 | External storage snapshot replaces the latest ref; discard still invokes update(next:Draft\|undefined) with a required undefined payload to remove sessionStorage. New draft-storage-lifecycle tests cover restore, scope, save and discard behavior. |
| apps/chat/components/eve/use-eve-message-delivery.ts | 2 | 2 | 0 | Real delivery snapshot store removes both initialization refs entirely while preserving operation acknowledgement/race behavior. New draft-storage-lifecycle tests cover first-event acknowledgements and scope changes. |
| apps/chat/components/ui/form.tsx | 2 | 0 | 2 | createContext(defaultValue:T) requires the default argument. FormFieldContext/FormItemContext undefined defaults trigger the explicit missing-provider contract, covered by assertion-contracts browser fixture. |
| apps/site/components/thread-playground-model.ts | 1 | 0 | 1 | Promise.withResolvers<undefined>().resolve requires value:undefined\|PromiseLike<undefined>. Site completed/stopped visual scenarios exercise completion and cancellation. Promise.withResolvers<void> violates no-invalid-void-type; Promise constructor alternative merely introduces promise/avoid-new debt. |
| apps/site/components/thread-showcase.tsx | 2 | 2 | 0 | Both ResizeObserver callbacks now explicitly return (()=>void)\|undefined, preserving missing-ref no-resource branches while satisfying consistent-return and no-useless-undefined together. Existing desktop/mobile visual scenarios cover layout and unmount. |

Pinned React declarations: node_modules/@types/react/index.d.ts707 createContext(defaultValue:T),1728/1740/1752 useRef(initialValue:...). Required native API signatures are direct concrete evidence, not generic library-boundary claims. Internal callbacks likewise explicitly model a required state payload which may be cleared; making arguments optional solely to remove lint would be cosmetic.

Scoped oxlint --type-aware components/hooks/providers/site plus lifecycle browser files passes with these targeted exceptions retained. /tmp/deprecated-ui-lint.json. No Promise<void> mockResolvedValue(undefined) calls exist in these14 memberships; zeroarg mocks were already handled previously.
