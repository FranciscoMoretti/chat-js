import { MessageScrollerProvider } from "@/components/ui/message-scroller";
import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import type { ReadonlyEveMessage } from "@/lib/eve/readonly-message-types";

import { ControlledChatComposer } from "../components/controlled-chat-composer";
import { EveMessages } from "../components/eve/eve-messages";
import { MessageSiblingsView } from "../components/message-siblings-view";
import { ResponseChoiceCards } from "../components/response-choice-cards";

const messages: readonly ReadonlyEveMessage[] = [
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

const Editor = ({
  onSubmit,
}: {
  readonly onSubmit?: (value: string) => void;
}): React.JSX.Element => {
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
  readonly message: ReadonlyEveMessage;
  readonly onLog: (value: string) => void;
}) => {
  if (message.role !== "user") {
    return null;
  }
  const isFirst = message.id === "user-1";
  return (
    <MessageSiblingsView
      count={isFirst ? 3 : 2}
      index={1}
      onNext={() => {
        onLog(`next:${message.id}`);
      }}
      onPrevious={() => {
        onLog(`prev:${message.id}`);
      }}
    />
  );
};

const Transcript = ({
  isReadonly,
  loading,
  onLog,
  title,
}: {
  readonly isReadonly: boolean;
  readonly loading: boolean;
  readonly onLog: (value: string) => void;
  readonly title: string;
}): React.JSX.Element => {
  const [editingId, setEditingId] = useState<string>();
  const edit = useMemo(():
    | {
        content: React.JSX.Element;
        disabled: boolean;
        messageId: string;
        onCancel: () => void;
      }
    | undefined => {
    if (editingId !== undefined && editingId !== null && editingId !== "") {
      return {
        content: (
          <Editor
            onSubmit={(value) => {
              onLog(`submit:${value}`);
            }}
          />
        ),
        disabled: false,
        messageId: editingId,
        onCancel: (): void => {
          setEditingId(undefined);
        },
      };
    }
    return undefined;
  }, [editingId, onLog]);
  return (
    <section
      aria-label={title}
      data-testid={isReadonly ? "readonly-transcript" : "editable-transcript"}
    >
      <h2 className="mb-2 text-lg font-medium">{title}</h2>
      <MessageScrollerProvider>
        <EveMessages
          actionsDisabled={loading}
          disabled={loading}
          editor={edit}
          isReadonly={isReadonly}
          messages={messages}
          modelForMessage={(message: {
            readonly metadata?:
              | { readonly modelId?: string | undefined }
              | undefined;
          }) => message.metadata?.modelId}
          onEdit={(message: { readonly id: string }) => {
            setEditingId(message.id);
            onLog(`edit:${message.id}`);
          }}
          onRegenerate={(
            user: { readonly id: string },
            response: { readonly id: string }
          ) => {
            onLog(`retry:${user.id}->${response.id}`);
          }}
          renderResponses={(message: { readonly id: string }) => {
            if (message.id === "user-1") {
              return inlineResponseCards;
            }
            return null;
          }}
          renderVersions={(message) => (
            <VersionControls message={message} onLog={onLog} />
          )}
          respond={() => {
            onLog("respond");
          }}
        />
      </MessageScrollerProvider>
    </section>
  );
};

const Fixture = (): React.JSX.Element => {
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState("comparison-a");
  const append = (value: string): void => {
    setLog((current: readonly string[]) => [...current, value]);
  };
  return (
    <main className="mx-auto max-w-4xl space-y-8 p-4">
      <h1 className="text-xl font-semibold">EVE message presentation</h1>
      <Transcript
        isReadonly={false}
        loading={false}
        onLog={append}
        title="Restored EVE — ready"
      />
      <Transcript
        isReadonly
        loading={false}
        onLog={append}
        title="Restored EVE — readonly"
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
          slots={comparisonSlots.map(
            (
              slot: Readonly<{
                handleSelect: () => null;
                id: string;
                loading: boolean;
                modelName: string;
                selected: boolean;
                statusLabel: string;
              }>
            ) => ({
              ...slot,
              handleSelect: (): void => {
                setSelected(slot.id);
              },
              selected: selected === slot.id,
            })
          )}
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
