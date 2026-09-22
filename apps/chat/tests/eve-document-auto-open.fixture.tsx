import { QueryClientProvider } from "@tanstack/react-query";
import type { EveMessagePart } from "eve/client";
import { useState } from "react";
import { createRoot } from "react-dom/client";

import { EveArtifactLayout } from "../components/eve/eve-artifact-layout";
import { EveDocumentTool } from "../components/eve/eve-document-tool";
import { SidebarProvider } from "../components/ui/sidebar";
import { useArtifact } from "../hooks/use-artifact";
import { TRPCProvider } from "../trpc/react";
import {
  conversationId,
  existingId,
  queryClient,
  trpcClient,
} from "./eve-artifact-query.fixture";

type Part = Extract<EveMessagePart, { type: "dynamic-tool" }>;
const completed: Part = {
  input: {},
  output: {
    date: "2026-01-01T00:00:00.000Z",
    documentId: "00000000-0000-4000-8000-000000000001",
    kind: "text",
    revisionId: "00000000-0000-4000-8000-000000000002",
    status: "success",
    title: "Orchard notes",
  },
  state: "output-available",
  toolCallId: "write-1",
  toolName: "createTextDocument",
  type: "dynamic-tool",
};
const Fixture = ({
  switchBranch,
  startBackground,
  startReplay,
  finishReplay,
}: {
  switchBranch: () => void;
  startBackground: () => void;
  startReplay: () => void;
  finishReplay: () => void;
}) => {
  const { artifact, setArtifact } = useArtifact();
  const [part, setPart] = useState<Part>(completed);
  const [readOnly, setReadOnly] = useState(false);
  return (
    <main className="space-y-4 p-6">
      <h1>Document opening</h1>
      <div className="flex flex-wrap gap-4">
        <button
          type="button"
          onClick={() => {
            startReplay();
            setPart({
              input: {
                content: "Replayed historical content",
                title: "Orchard notes",
              },
              inputText: "{}",
              state: "input-streaming",
              toolCallId: "write-1",
              toolName: "createTextDocument",
              type: "dynamic-tool",
            });
          }}
        >
          Start replay
        </button>
        <button type="button" onClick={finishReplay}>
          Finish replay
        </button>
        <button type="button" onClick={startBackground}>
          Start background execution
        </button>
        <button type="button" onClick={switchBranch}>
          Switch branch
        </button>
        <button
          onClick={() =>
            setPart({
              input: {
                content:
                  "# Orchard notes\n\nPartial apple planting instructions.",
                title: "Orchard notes",
              },
              state: "input-available",
              toolCallId: "write-1",
              toolName: "createTextDocument",
              type: "dynamic-tool",
            })
          }
          type="button"
        >
          Start write
        </button>
        <button
          onClick={() =>
            setPart({
              errorText: "Document cancelled.",
              input: {},
              state: "output-error",
              toolCallId: "write-1",
              toolName: "createTextDocument",
              type: "dynamic-tool",
            })
          }
          type="button"
        >
          Fail write
        </button>
        <button onClick={() => setPart({ ...completed })} type="button">
          Complete write
        </button>
        <button
          onClick={() => setPart({ ...completed, toolName: "readDocument" })}
          type="button"
        >
          Complete read
        </button>
        <button onClick={() => setReadOnly((value) => !value)} type="button">
          Toggle readonly
        </button>
        <button
          onClick={() =>
            setArtifact({
              ...artifact,
              conversationId,
              documentId: existingId,
              followLive: true,
              isVisible: true,
              revisionId: undefined,
              title: "Existing draft",
            })
          }
          type="button"
        >
          Open existing
        </button>
      </div>
      <p>Mode: {readOnly ? "readonly" : "owner"}</p>
      <EveDocumentTool isReadonly={readOnly} messageId="message" part={part} />
    </main>
  );
};
const App = () => {
  const [branch, setBranch] = useState(conversationId);
  const [replaying, setReplaying] = useState(false);
  const [busy, setBusy] = useState<boolean>();
  const [stopped, setStopped] = useState("");
  return (
    <>
      <p>Stopped session: {stopped}</p>
      <EveArtifactLayout
        conversationId={branch}
        logicalChatId="logical-chat"
        replaying={replaying}
        isExecutionBusy={
          busy === undefined ? undefined : (id) => busy && id === conversationId
        }
        onStopExecution={(id) => {
          setStopped(id);
          setBusy(false);
          return Promise.resolve();
        }}
      >
        <Fixture
          startReplay={() => setReplaying(true)}
          finishReplay={() => setReplaying(false)}
          startBackground={() => setBusy(true)}
          switchBranch={() => setBranch("00000000-0000-4000-8000-000000000099")}
        />
      </EveArtifactLayout>
    </>
  );
};
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
      <SidebarProvider defaultOpen={false}>
        <App />
      </SidebarProvider>
    </TRPCProvider>
  </QueryClientProvider>
);
