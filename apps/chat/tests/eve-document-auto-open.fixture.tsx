import type { EveMessagePart } from "eve/client";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { EveDocumentTool } from "../components/eve/eve-document-tool";
import { ArtifactProvider, useArtifact } from "../hooks/use-artifact";

type Part = Extract<EveMessagePart, { type: "dynamic-tool" }>;
const completed: Part = {
  type: "dynamic-tool",
  toolName: "createTextDocument",
  toolCallId: "write-1",
  state: "output-available",
  input: {},
  output: {
    status: "success",
    documentId: "00000000-0000-4000-8000-000000000001",
    revisionId: "00000000-0000-4000-8000-000000000002",
    title: "Orchard notes",
    kind: "text",
    date: "2026-01-01T00:00:00.000Z",
  },
};
function Fixture() {
  const { artifact, closeArtifact, setArtifact } = useArtifact();
  const [part, setPart] = useState<Part>(completed);
  const [readOnly, setReadOnly] = useState(false);
  return (
    <main className="space-y-4 p-6">
      <h1>Document opening</h1>
      <div className="flex flex-wrap gap-4">
        <button
          onClick={() =>
            setPart({
              type: "dynamic-tool",
              toolName: "createTextDocument",
              toolCallId: "write-1",
              state: "input-available",
              input: {},
            })
          }
          type="button"
        >
          Start write
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
              title: "Existing draft",
              documentId: "existing",
              isVisible: true,
            })
          }
          type="button"
        >
          Open existing
        </button>
      </div>
      <p>Mode: {readOnly ? "readonly" : "owner"}</p>
      <EveDocumentTool isReadonly={readOnly} messageId="message" part={part} />
      {artifact.isVisible && (
        <section aria-label="Opened artifact" className="rounded border p-4">
          <h2>{artifact.title}</h2>
          <button onClick={closeArtifact} type="button">
            Close artifact
          </button>
        </section>
      )}
    </main>
  );
}
const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(
  <ArtifactProvider>
    <Fixture />
  </ArtifactProvider>
);
