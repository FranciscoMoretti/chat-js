import type { EveMessage } from "eve/client";
import { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import { ControlledChatComposer } from "../components/controlled-chat-composer";
import { EveMessages } from "../components/eve/eve-messages";
import { MessageSiblingsView } from "../components/message-siblings-view";
import { ResponseChoiceCards } from "../components/response-choice-cards";
import { LegacyUserMessageReference } from "./eve-message-presentation.legacy";

const messages: readonly EveMessage[] = [
  {
    id: "user-1",
    metadata: { status: "complete", turnId: "turn_0" },
    parts: [{ state: "done", text: "First user message", type: "text" }],
    role: "user",
  },
  {
    id: "assistant-1",
    metadata: { modelId: "model-a", status: "complete", turnId: "turn_0" },
    parts: [{ state: "done", text: "First assistant response", type: "text" }],
    role: "assistant",
  },
  {
    id: "user-2",
    metadata: { status: "complete", turnId: "turn_1" },
    parts: [{ state: "done", text: "Second user message", type: "text" }],
    role: "user",
  },
  {
    id: "assistant-2",
    metadata: { modelId: "model-b", status: "complete", turnId: "turn_1" },
    parts: [{ state: "done", text: "Second assistant response", type: "text" }],
    role: "assistant",
  },
];

const comparisonSlots = [
  {
    handleSelect: () => null,
    id: "comparison-a",
    loading: false,
    modelName: "Model A",
    selected: true,
    statusLabel: "Selected",
  },
  {
    handleSelect: () => null,
    id: "comparison-b",
    loading: true,
    modelName: "Model B",
    selected: false,
    statusLabel: "Generating...",
  },
];

const inlineResponseCards = (
  <div data-testid="inline-response-cards">
    <ResponseChoiceCards slots={comparisonSlots} />
  </div>
);

const Editor = ({ onSubmit }: { onSubmit?: (value: string) => void }) => {
  const [draft, setDraft] = useState("First user message");
  return (
    <div className="w-full space-y-2" data-testid="inline-editor">
      <ControlledChatComposer
        autoFocus
        draft={draft}
        disabled={false}
        onDraftChange={setDraft}
        onSubmit={() => {
          if (onSubmit) {
            onSubmit(draft);
          }
        }}
        tools={<span className="px-2 text-xs">Tools</span>}
      />
    </div>
  );
};

const VersionControls = ({
  message,
  onLog,
}: {
  message: EveMessage;
  onLog: (value: string) => void;
}) => {
  if (message.role !== "user") {
    return null;
  }
  const isFirst = message.id === "user-1";
  return (
    <MessageSiblingsView
      count={isFirst ? 3 : 2}
      index={1}
      onNext={() => onLog(`next:${message.id}`)}
      onPrevious={() => onLog(`prev:${message.id}`)}
    />
  );
};

const Transcript = ({
  isReadonly,
  loading,
  onLog,
  title,
}: {
  isReadonly: boolean;
  loading: boolean;
  onLog: (value: string) => void;
  title: string;
}) => {
  const [editingId, setEditingId] = useState<string>();
  const edit = useMemo(
    () =>
      editingId
        ? {
            content: <Editor onSubmit={(value) => onLog(`submit:${value}`)} />,
            disabled: false,
            messageId: editingId,
            onCancel: () => setEditingId(undefined),
          }
        : undefined,
    [editingId, onLog]
  );
  return (
    <section
      aria-label={title}
      data-testid={isReadonly ? "readonly-transcript" : "editable-transcript"}
    >
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      <EveMessages
        actionsDisabled={loading}
        disabled={loading}
        editor={edit}
        isReadonly={isReadonly}
        messages={messages}
        modelForMessage={(message) => message.metadata?.modelId}
        onEdit={(message) => {
          setEditingId(message.id);
          onLog(`edit:${message.id}`);
        }}
        onRegenerate={(user, response) =>
          onLog(`retry:${user.id}->${response.id}`)
        }
        renderResponses={(message) =>
          message.id === "user-1" ? inlineResponseCards : null
        }
        renderVersions={(message) => (
          <VersionControls message={message} onLog={onLog} />
        )}
        respond={() => onLog("respond")}
      />
    </section>
  );
};

const LegacyReference = ({
  isReadonly,
  loading,
  title,
}: {
  isReadonly: boolean;
  loading: boolean;
  title: string;
}) => {
  const [versionIndex, setVersionIndex] = useState(1);
  let testId = "legacy-reference";
  if (isReadonly) {
    testId = "legacy-readonly";
  } else if (loading) {
    testId = "legacy-pending";
  }
  return (
    <section aria-label={title} className="space-y-2" data-testid={testId}>
      <h2 className="text-lg font-medium">{title}</h2>
      <LegacyUserMessageReference
        editor={<Editor />}
        isLoading={loading}
        isReadonly={isReadonly}
        messageId="legacy-user-1"
        responses={inlineResponseCards}
        siblings={
          <MessageSiblingsView
            count={3}
            index={versionIndex}
            onNext={() => setVersionIndex((index) => Math.min(index + 1, 2))}
            onPrevious={() =>
              setVersionIndex((index) => Math.max(index - 1, 0))
            }
          />
        }
        text="First user message"
      />
    </section>
  );
};

const Fixture = () => {
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState("comparison-a");
  const append = (value: string) => setLog((current) => [...current, value]);
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4">
      <h1 className="text-xl font-semibold">EVE message presentation</h1>
      <Transcript
        isReadonly={false}
        loading={false}
        onLog={append}
        title="Restored EVE — ready"
      />
      <LegacyReference
        isReadonly={false}
        loading={false}
        title="Original main — ready"
      />
      <Transcript
        isReadonly
        loading={false}
        onLog={append}
        title="Restored EVE — readonly"
      />
      <LegacyReference
        isReadonly
        loading={false}
        title="Original main — readonly"
      />
      <Transcript
        isReadonly={false}
        loading
        onLog={append}
        title="Restored EVE — pending"
      />
      <section aria-label="Comparison cards" data-testid="comparison-cards">
        <h2 className="text-lg font-medium">Comparison cards</h2>
        <ResponseChoiceCards
          slots={comparisonSlots.map((slot) => ({
            ...slot,
            handleSelect: () => setSelected(slot.id),
            selected: selected === slot.id,
          }))}
        />
      </section>
      <output aria-label="Interaction log" data-testid="interaction-log">
        {log.join("|")}
      </output>
    </main>
  );
};

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
