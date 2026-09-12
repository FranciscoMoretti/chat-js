import { type ReactNode, useEffect, useState } from "react";
import { useEveComposerDraft } from "../components/eve/use-eve-composer-draft";
import { models } from "../lib/ai/models.generated";
import { firstModel, secondModel } from "./eve-comparison-data.fixture";

const fixtureModels = models
  .filter((model) => model.id === firstModel || model.id === secondModel)
  .map((model) => ({ ...model, apiModelId: model.id }));
const modelContext = {
  models: fixtureModels,
  allModels: fixtureModels,
  getModelById: (id: string) => fixtureModels.find((model) => model.id === id),
};
export const useChatModels = () => modelContext;
export const useSession = () => ({
  data: { user: { id: "comparison-fixture-owner" } },
  isPending: false,
});
export function EveArtifactLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function ChatWelcomeView({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-3xl p-4">{children}</main>;
}
export function InternalLink({
  children,
  href,
}: {
  children: ReactNode;
  href: string;
}) {
  return <a href={href}>{children}</a>;
}
export function EveConversation({
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
}) {
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
                url: "https://files.test/owned.pdf",
                name: "notes.pdf",
                contentType: "application/pdf",
                digest: "fixture-digest",
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
}
