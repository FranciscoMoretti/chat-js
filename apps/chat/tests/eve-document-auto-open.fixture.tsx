/* oxlint-disable import/no-relative-parent-imports -- * import/no-relative-parent-imports (#530): Keep the explicit "../components/eve/eve-artifact-layout"; "../components/eve/eve-document-tool"; "../components/ui/sidebar"; "../hooks/use-artifact"; "../trpc/react" dependency within this package instead of introducing an alias or barrel API. */
import { QueryClientProvider } from "@tanstack/react-query";
import type { EveMessagePart } from "eve/client";
import React, { useState } from "react";
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
/* oxlint-enable import/no-relative-parent-imports */

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
/* oxlint-disable max-lines-per-function, no-undefined, react/only-export-components, typescript/prefer-readonly-parameter-types -- * max-lines-per-function (#510): Fixture keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): Fixture uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * react/only-export-components (#553): Fixture is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/prefer-readonly-parameter-types (#565): Fixture accepts { switchBranch, startBackground, startReplay, finishReplay, }: { switchBranch: () => ; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
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
}): React.JSX.Element => {
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
/* oxlint-enable max-lines-per-function, no-undefined, react/only-export-components, typescript/prefer-readonly-parameter-types*/
/* oxlint-disable no-undefined, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/promise-function-async -- * no-undefined (#519): App uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * react-perf/jsx-no-new-function-as-prop (#557): App creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/no-multi-comp (#552): App keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/only-export-components (#553): App is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/promise-function-async (#606): App preserves the returned promise and synchronous throw timing; adding async would wrap the promise and convert immediate throws into rejections. */
const App = (): React.JSX.Element => {
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
/* oxlint-enable no-undefined, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/promise-function-async */
const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
/* oxlint-disable react/jsx-max-depth -- * react/jsx-max-depth (#548): createRoot(root).render keeps related fixture render states together; extraction changes component, state, and layout boundaries. */
createRoot(root).render(
  <QueryClientProvider client={queryClient}>
    <TRPCProvider queryClient={queryClient} trpcClient={trpcClient}>
      <SidebarProvider defaultOpen={false}>
        <App />
      </SidebarProvider>
    </TRPCProvider>
  </QueryClientProvider>
);
/* oxlint-enable react/jsx-max-depth */
