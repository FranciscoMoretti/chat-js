import React, { useEffect, useState } from "react";

import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ReadonlyReactNode } from "@/lib/readonly-react-node";

import { ComposerMenu } from "../components/composer/composer-menu";
import { useEveComposerDraft } from "../components/eve/use-eve-composer-draft";
import { models } from "../lib/ai/models.generated";
import { useDefaultModel } from "../providers/default-model-provider";
import { firstModel, secondModel } from "./eve-comparison-data.fixture";

const fixtureModels = models
  .filter(
    (model: Readonly<Pick<(typeof models)[number], "id">>) =>
      model.id === firstModel || model.id === secondModel
  )
  .map((model: ReadonlyNativeSurface<(typeof models)[number]>) => ({
    ...model,
    apiModelId: model.id,
    input: { image: true, pdf: true, text: true },
    name: model.id === firstModel ? "First model" : "Second model",
  }));

const modelContext = {
  allModels: fixtureModels,
  getModelById: (id: string) =>
    fixtureModels.find(
      (model: Readonly<Pick<(typeof fixtureModels)[number], "id">>) =>
        model.id === id
    ),
  models: fixtureModels,
};
const useChatModels = () => modelContext;
const useSession = () => ({
  data: { user: { id: "comparison-fixture-owner" } },
  isPending: false,
});
// Comparisons use no connected MCP servers; the real control is covered by eve-mcp.e2e.ts.
const ConnectorsControl = () => null;

const EveArtifactLayout = ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}) => children;

const ChatWelcomeView = ({
  children,
}: {
  readonly children: ReadonlyReactNode;
}): React.JSX.Element => (
  <main className="mx-auto max-w-3xl p-4">{children}</main>
);
const InternalLink = ({
  children,
  href,
}: {
  readonly children: ReadonlyReactNode;
  readonly href: string;
}): React.JSX.Element => <a href={href}>{children}</a>;
const useRouter = () => ({
  push: (href: string): void => {
    globalThis.location.assign(href);
  },
});

const usePathname = (): string => globalThis.location.pathname;

const EveConversation = ({
  header,
  sessionId,
  ownerId,
  draftScopeId,
  onStatusChange,
  onNavigationBlockedChange,
  comparisonPresentation,
}: {
  readonly header: ReadonlyReactNode;
  readonly sessionId: string;
  readonly ownerId: string;
  readonly draftScopeId: string;
  readonly onStatusChange?: (status: "ready") => void;
  readonly onNavigationBlockedChange?: (blocked: boolean) => void;
  readonly comparisonPresentation?: { readonly cards: ReadonlyReactNode };
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
          onToolChange={(value) => {
            draft.setSelectedTool(value);
          }}
          onAttach={() => {
            // Attachment uploads are outside this comparison fixture.
          }}
          selectedTool={draft.selectedTool}
        />
        <label>
          Follow-up draft
          <textarea
            className="block w-full rounded border p-3"
            onChange={(event: {
              readonly target: { readonly value: string };
            }) => {
              draft.setText(event.target.value);
            }}
            value={draft.text}
          />
        </label>
        <button
          onClick={() => {
            draft.setAttachments([
              {
                contentType: "application/pdf",
                digest: "fixture-digest",
                name: "notes.pdf",
                url: "https://files.test/owned.pdf",
              },
            ]);
          }}
          type="button"
        >
          Attach fixture PDF
        </button>
        {draft.attachments.map((file) => (
          <p key={file.url}>{file.name}</p>
        ))}
        <button
          onClick={() => {
            setPending((value) => !value);
          }}
          type="button"
        >
          {pending ? "Resolve pending send" : "Simulate pending send"}
        </button>
      </section>
    </main>
  );
};

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
