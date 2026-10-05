/* oxlint-disable import/no-relative-parent-imports -- * import/no-relative-parent-imports (#530): Keep the explicit "../components/composer/composer-menu"; "../components/eve/use-eve-composer-draft"; "../lib/ai/models.generated"; "../providers/default-model-provider" dependency within this package instead of introducing an alias or barrel API. */
import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";

/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { ComposerMenu } from "../components/composer/composer-menu";
/* oxlint-enable sort-imports */
import { useEveComposerDraft } from "../components/eve/use-eve-composer-draft";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { models } from "../lib/ai/models.generated";
/* oxlint-enable sort-imports */
import { useDefaultModel } from "../providers/default-model-provider";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { firstModel, secondModel } from "./eve-comparison-data.fixture";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- * typescript/prefer-readonly-parameter-types (#565): fixtureModels accepts model; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
const fixtureModels = models
  .filter((model) => model.id === firstModel || model.id === secondModel)
  // oxlint-disable-next-line oxc/no-map-spread -- #541: Override fixture model IDs without mutating the shared model catalog.
  .map((model) => ({
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing model own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...model,
    apiModelId: model.id,
    input: { image: true, pdf: true, text: true },
    name: model.id === firstModel ? "First model" : "Second model",
  }));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types -- * typescript/explicit-function-return-type (#560): Keep modelContext's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): modelContext accepts model; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
const modelContext = {
  allModels: fixtureModels,
  getModelById: (id: string) => fixtureModels.find((model) => model.id === id),
  models: fixtureModels,
};
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- splitting exports requires an API and Fast Refresh boundary decision.
typescript/explicit-function-return-type (#560): Keep useChatModels's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep useChatModels's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary. */
const useChatModels = () => modelContext;
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- splitting exports requires an API and Fast Refresh boundary decision.
typescript/explicit-function-return-type (#560): Keep useSession's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep useSession's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary. */
const useSession = () => ({
  data: { user: { id: "comparison-fixture-owner" } },
  isPending: false,
});
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null -- typescript/explicit-function-return-type (#560): Keep ConnectorsControl's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep ConnectorsControl's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
unicorn/no-null (#570): ConnectorsControl preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
// Comparisons use no connected MCP servers; the real control is covered by eve-mcp.e2e.ts.
const ConnectorsControl = () => null;
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- typescript/explicit-function-return-type (#560): Keep EveArtifactLayout's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep EveArtifactLayout's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
typescript/prefer-readonly-parameter-types (#565): EveArtifactLayout accepts { children }: { children: ReactNode }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
typescript/promise-function-async (#606): EveArtifactLayout preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
const EveArtifactLayout = ({ children }: { children: ReactNode }) => children;
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- react/no-multi-comp (#552): ChatWelcomeView keeps related fixture render states together; extraction changes component, state, and layout boundaries.
typescript/prefer-readonly-parameter-types (#565): ChatWelcomeView accepts { children }: { children: ReactNode }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
const ChatWelcomeView = ({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element => (
  <main className="mx-auto max-w-3xl p-4">{children}</main>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- react/no-multi-comp (#552): InternalLink keeps related fixture render states together; extraction changes component, state, and layout boundaries.
typescript/prefer-readonly-parameter-types (#565): InternalLink accepts { children, href, }: { children: ReactNode; href: string; }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
const InternalLink = ({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}): React.JSX.Element => <a href={href}>{children}</a>;
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */
/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- splitting exports requires an API and Fast Refresh boundary decision.
typescript/explicit-function-return-type (#560): Keep useRouter's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
typescript/explicit-module-boundary-types (#562): Keep useRouter's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary. */
const useRouter = () => ({
  push: (href: string): void => globalThis.location.assign(href),
});
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */

const usePathname = (): string => globalThis.location.pathname;
/* oxlint-disable react/jsx-no-literals -- EveConversation renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null -- max-lines-per-function (#510): EveConversation keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
react-perf/jsx-no-new-function-as-prop (#557): EveConversation creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
react/jsx-max-depth (#548): EveConversation keeps related fixture render states together; extraction changes component, state, and layout boundaries.
react/no-multi-comp (#552): EveConversation keeps related fixture render states together; extraction changes component, state, and layout boundaries.
typescript/prefer-readonly-parameter-types (#565): EveConversation accepts { header, sessionId, ownerId, draftScopeId, onStatusChange, onNavigationBlockedChange; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
typescript/strict-void-return (#611): EveConversation's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
unicorn/no-null (#570): EveConversation preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
const EveConversation = ({
  header,
  sessionId,
  ownerId,
  draftScopeId,
  onStatusChange,
  onNavigationBlockedChange,
  comparisonPresentation,
}: {
  header: ReactNode;
  sessionId: string;
  ownerId: string;
  draftScopeId: string;
  onStatusChange?: (status: "ready") => void;
  onNavigationBlockedChange?: (blocked: boolean) => void;
  comparisonPresentation?: { cards: ReactNode };
}): React.JSX.Element => {
  const model = useDefaultModel();
  const draft = useEveComposerDraft(ownerId, draftScopeId);
  const [pending, setPending] = useState(false);
  useEffect(() => onStatusChange?.("ready"), [onStatusChange]);
  useEffect(
    () =>
      onNavigationBlockedChange?.(
        !draft.loaded || Boolean(draft.error) || pending
      ),
    [onNavigationBlockedChange, draft.loaded, draft.error, pending]
  );
  return (
    <main>
      {header}
      <section className="mx-auto max-w-3xl space-y-4 p-4">
        {comparisonPresentation?.cards}
        <p>Selected native session: {sessionId}</p>
        <p>Follow-up model: {model}</p>
        <ComposerMenu
          disabled={pending}
          selectedModelId={model}
          onToolChange={(value) => draft.setSelectedTool(value)}
          onAttach={() => null}
          selectedTool={draft.selectedTool}
        />
        <label>
          Follow-up draft
          <textarea
            className="block w-full rounded border p-3"
            onChange={(event) => draft.setText(event.target.value)}
            value={draft.text}
          />
        </label>
        <button
          onClick={() =>
            draft.setAttachments([
              {
                contentType: "application/pdf",
                digest: "fixture-digest",
                name: "notes.pdf",
                url: "https://files.test/owned.pdf",
              },
            ])
          }
          type="button"
        >
          Attach fixture PDF
        </button>
        {draft.attachments.map((file) => (
          <p key={file.url}>{file.name}</p>
        ))}
        <button onClick={() => setPending((value) => !value)} type="button">
          {pending ? "Resolve pending send" : "Simulate pending send"}
        </button>
      </section>
    </main>
  );
};
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (ChatWelcomeView, ConnectorsControl, EveArtifactLayout, EveConversation, InternalLink, useChatModels, usePathname, useRouter, useSession); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null */
/* oxlint-disable react/only-export-components -- #620: This comparison fixture intentionally exports hook mocks and reference components from one test module; it is not a production Fast Refresh boundary. */
export {
  ChatWelcomeView,
  ConnectorsControl,
  EveArtifactLayout,
  EveConversation,
  InternalLink,
  useChatModels,
  usePathname,
  useRouter,
  useSession,
};
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/only-export-components */
