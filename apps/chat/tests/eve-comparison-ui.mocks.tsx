import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { useEveComposerDraft } from "../components/eve/use-eve-composer-draft";
import { ResponsiveTools } from "../components/responsive-tools";
import { models } from "../lib/ai/models.generated";
import { useDefaultModel } from "../providers/default-model-provider";
import { firstModel, secondModel } from "./eve-comparison-data.fixture";

const fixtureModels = models
  .filter((model) => model.id === firstModel || model.id === secondModel)
  .map((model) => ({
    ...model,
    apiModelId: model.id,
    input: { image: true, pdf: true, text: true },
    name: model.id === firstModel ? "First model" : "Second model",
  }));
const modelContext = {
  allModels: fixtureModels,
  getModelById: (id: string) => fixtureModels.find((model) => model.id === id),
  models: fixtureModels,
};
export const useChatModels = () => modelContext;
export const useSession = () => ({
  data: { user: { id: "comparison-fixture-owner" } },
  isPending: false,
});
// Comparisons use no connected MCP servers; the real control is covered by eve-mcp.e2e.ts.
export const ConnectorsDropdown = () => null;
export const EveArtifactLayout = ({ children }: { children: ReactNode }) =>
  children;
export const ChatWelcomeView = ({ children }: { children: ReactNode }) => (
  <main className="mx-auto max-w-3xl p-4">{children}</main>
);
export const InternalLink = ({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) => <a href={href}>{children}</a>;
export const EveConversation = ({
  header,
  sessionId,
  ownerId,
  draftScopeId,
  onStatusChange,
  onNavigationBlockedChange,
}: {
  header: ReactNode;
  sessionId: string;
  ownerId: string;
  draftScopeId: string;
  onStatusChange?: (status: "ready") => void;
  onNavigationBlockedChange?: (blocked: boolean) => void;
}) => {
  const model = useDefaultModel();
  const draft = useEveComposerDraft(ownerId, draftScopeId);
  const [pending, setPending] = useState(false);
  useEffect(() => onStatusChange?.("ready"), [onStatusChange]);
  useEffect(
    () =>
      onNavigationBlockedChange?.(!draft.loaded || !!draft.error || pending),
    [onNavigationBlockedChange, draft.loaded, draft.error, pending]
  );
  return (
    <main>
      {header}
      <section className="mx-auto max-w-3xl space-y-4 p-4">
        <p>Selected native session: {sessionId}</p>
        <p>Follow-up model: {model}</p>
        <ResponsiveTools
          disabled={pending}
          selectedModelId={model}
          setTools={draft.setSelectedTool}
          tools={draft.selectedTool}
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
