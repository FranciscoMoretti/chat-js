/* oxlint-disable import/no-relative-parent-imports -- * import/no-relative-parent-imports (#530): Keep the explicit "../components/composer/composer-menu"; "../components/eve/use-eve-composer-draft"; "../lib/ai/models.generated"; "../providers/default-model-provider" dependency within this package instead of introducing an alias or barrel API. */
import React, { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { ComposerMenu } from "../components/composer/composer-menu";
import { useEveComposerDraft } from "../components/eve/use-eve-composer-draft";
import { models } from "../lib/ai/models.generated";
import { useDefaultModel } from "../providers/default-model-provider";
import { firstModel, secondModel } from "./eve-comparison-data.fixture";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- * typescript/prefer-readonly-parameter-types (#565): fixtureModels accepts model; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
const fixtureModels = models
  .filter((model) => model.id === firstModel || model.id === secondModel)
  // oxlint-disable-next-line oxc/no-map-spread -- #541: Override fixture model IDs without mutating the shared model catalog.
  .map((model) => ({
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
/* oxlint-disable import/group-exports, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- * import/group-exports (#523): useChatModels stays exported at its declaration so its public contract is visible beside its implementation.
 * react/only-export-components (#553): useChatModels is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/explicit-function-return-type (#560): Keep useChatModels's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep useChatModels's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary. */
export const useChatModels = () => modelContext;
/* oxlint-enable import/group-exports, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable import/group-exports, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- * import/group-exports (#523): useSession stays exported at its declaration so its public contract is visible beside its implementation.
 * react/only-export-components (#553): useSession is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/explicit-function-return-type (#560): Keep useSession's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep useSession's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary. */
export const useSession = () => ({
  data: { user: { id: "comparison-fixture-owner" } },
  isPending: false,
});
/* oxlint-enable import/group-exports, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null -- * import/group-exports (#523): ConnectorsControl stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/explicit-function-return-type (#560): Keep ConnectorsControl's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep ConnectorsControl's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): ConnectorsControl preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
// Comparisons use no connected MCP servers; the real control is covered by eve-mcp.e2e.ts.
export const ConnectorsControl = () => null;
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, unicorn/no-null */
/* oxlint-disable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async -- * import/group-exports (#523): EveArtifactLayout stays exported at its declaration so its public contract is visible beside its implementation.
 * typescript/explicit-function-return-type (#560): Keep EveArtifactLayout's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep EveArtifactLayout's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): EveArtifactLayout accepts { children }: { children: ReactNode }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/promise-function-async (#606): EveArtifactLayout preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
export const EveArtifactLayout = ({ children }: { children: ReactNode }) =>
  children;
/* oxlint-enable import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/promise-function-async */
/* oxlint-disable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- * import/group-exports (#523): ChatWelcomeView stays exported at its declaration so its public contract is visible beside its implementation.
 * react/no-multi-comp (#552): ChatWelcomeView keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * typescript/prefer-readonly-parameter-types (#565): ChatWelcomeView accepts { children }: { children: ReactNode }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
export const ChatWelcomeView = ({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element => (
  <main className="mx-auto max-w-3xl p-4">{children}</main>
);
/* oxlint-enable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- * import/group-exports (#523): InternalLink stays exported at its declaration so its public contract is visible beside its implementation.
 * react/no-multi-comp (#552): InternalLink keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * typescript/prefer-readonly-parameter-types (#565): InternalLink accepts { children, href, }: { children: ReactNode; href: string; }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
export const InternalLink = ({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}): React.JSX.Element => <a href={href}>{children}</a>;
/* oxlint-enable import/group-exports, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
/* oxlint-disable import/group-exports, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- * import/group-exports (#523): useRouter stays exported at its declaration so its public contract is visible beside its implementation.
 * react/only-export-components (#553): useRouter is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/explicit-function-return-type (#560): Keep useRouter's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/explicit-module-boundary-types (#562): Keep useRouter's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary. */
export const useRouter = () => ({
  push: (href: string): void => globalThis.location.assign(href),
});
/* oxlint-enable import/group-exports, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
/* oxlint-disable import/group-exports, react/only-export-components -- * import/group-exports (#523): usePathname stays exported at its declaration so its public contract is visible beside its implementation.
 * react/only-export-components (#553): usePathname is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision. */
export const usePathname = (): string => globalThis.location.pathname;
/* oxlint-enable import/group-exports, react/only-export-components */
/* oxlint-disable import/group-exports, max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null -- * import/group-exports (#523): EveConversation stays exported at its declaration so its public contract is visible beside its implementation.
 * max-lines-per-function (#510): EveConversation keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * react-perf/jsx-no-new-function-as-prop (#557): EveConversation creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/jsx-max-depth (#548): EveConversation keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/no-multi-comp (#552): EveConversation keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * typescript/prefer-readonly-parameter-types (#565): EveConversation accepts { header, sessionId, ownerId, draftScopeId, onStatusChange, onNavigationBlockedChange; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-void-return (#611): EveConversation's void callback contract discards its result; changing the callback API or operation order solely to hide the return value is unnecessary.
 * unicorn/no-null (#570): EveConversation preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
export const EveConversation = ({
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
/* oxlint-enable import/group-exports, max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-void-return, unicorn/no-null */
