/* oxlint-disable import/no-relative-parent-imports -- * import/no-relative-parent-imports (#530): Keep the explicit "../components/controlled-chat-composer"; "../components/eve/eve-messages"; "../components/message-siblings-view"; "../components/response-choice-cards" dependency within this package instead of introducing an alias or barrel API. */
import type { EveMessage } from "eve/client";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import React, { useMemo, useState } from "react";
/* oxlint-enable sort-imports */
import { createRoot } from "react-dom/client";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ControlledChatComposer } from "../components/controlled-chat-composer";
/* oxlint-enable sort-imports */
import { EveMessages } from "../components/eve/eve-messages";
import { MessageSiblingsView } from "../components/message-siblings-view";
import { ResponseChoiceCards } from "../components/response-choice-cards";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { LegacyUserMessageReference } from "./eve-message-presentation.legacy";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

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

/* oxlint-disable typescript/explicit-function-return-type, unicorn/no-null -- * typescript/explicit-function-return-type (#560): Keep comparisonSlots's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * unicorn/no-null (#570): comparisonSlots preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
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
/* oxlint-enable typescript/explicit-function-return-type, unicorn/no-null */

const inlineResponseCards = (
  <div data-testid="inline-response-cards">
    <ResponseChoiceCards slots={comparisonSlots} />
  </div>
);
/* oxlint-disable react/jsx-no-literals -- Editor renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */

/* oxlint-disable react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/only-export-components, typescript/prefer-readonly-parameter-types -- * react-perf/jsx-no-jsx-as-prop (#555): Editor creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react-perf/jsx-no-new-function-as-prop (#557): Editor creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/only-export-components (#553): Editor is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/prefer-readonly-parameter-types (#565): Editor accepts { onSubmit }: { onSubmit?: (value: string) => void }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
const Editor = ({
  onSubmit,
}: {
  onSubmit?: (value: string) => void;
}): React.JSX.Element => {
  const [draft, setDraft] = useState("First user message");
  return (
    <div className="w-full space-y-2" data-testid="inline-editor">
      <ControlledChatComposer
        // oxlint-disable-next-line jsx-a11y/no-autofocus -- #536: This fixture reproduces focus entering the inline message editor after the user chooses Edit.
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/only-export-components, typescript/prefer-readonly-parameter-types */

/* oxlint-disable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- * no-magic-numbers (#517): VersionControls uses 3, 2 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * react-perf/jsx-no-new-function-as-prop (#557): VersionControls creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/no-multi-comp (#552): VersionControls keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/only-export-components (#553): VersionControls is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/explicit-function-return-type (#560): Keep VersionControls's return type inferred from its fixture/mock result; an independent annotation requires selecting the intended public type boundary.
 * typescript/prefer-readonly-parameter-types (#565): VersionControls accepts { message, onLog, }: { message: EveMessage; onLog: (value: string) => void; }; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * unicorn/no-null (#570): VersionControls preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
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
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- * max-lines-per-function (#510): Transcript keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): Transcript uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * react-perf/jsx-no-new-function-as-prop (#557): Transcript creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/no-multi-comp (#552): Transcript keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/only-export-components (#553): Transcript is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/prefer-readonly-parameter-types (#565): Transcript accepts { isReadonly, loading, onLog, title, }: { isReadonly: boolean; loading: boolean; onLo; message; user; response; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): Transcript intentionally keeps the existing falsy-value behavior of editingId; distinguishing empty, zero, and absent states requires a domain behavior decision.
 * unicorn/no-null (#570): Transcript preserves explicit null in its scenario payloads and expectations; undefined has different serialization and presence semantics. */
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
}): React.JSX.Element => {
  const [editingId, setEditingId] = useState<string>();
  const edit = useMemo(
    () =>
      editingId
        ? {
            content: <Editor onSubmit={(value) => onLog(`submit:${value}`)} />,
            disabled: false,
            messageId: editingId,
            onCancel: (): void => setEditingId(undefined),
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
/* oxlint-enable max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable no-magic-numbers, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/prefer-readonly-parameter-types -- * no-magic-numbers (#517): LegacyReference uses 1, 2, 0 as scenario inputs, expected counts, statuses, or timing fixtures; extracting arbitrary shared constants would couple independent cases.
 * react-perf/jsx-no-jsx-as-prop (#555): LegacyReference creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react-perf/jsx-no-new-function-as-prop (#557): LegacyReference creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/no-multi-comp (#552): LegacyReference keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/only-export-components (#553): LegacyReference is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/prefer-readonly-parameter-types (#565): LegacyReference accepts { isReadonly, loading, title, }: { isReadonly: boolean; loading: boolean; title: stri; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
const LegacyReference = ({
  isReadonly,
  loading,
  title,
}: {
  isReadonly: boolean;
  loading: boolean;
  title: string;
}): React.JSX.Element => {
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
/* oxlint-disable react/jsx-no-literals -- Fixture renders authored static fixture captions and expected interface copy; no translation-layer contract is defined here. */
/* oxlint-enable no-magic-numbers, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/prefer-readonly-parameter-types -- * max-lines-per-function (#510): Fixture keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * react-perf/jsx-no-new-array-as-prop (#556): Fixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react-perf/jsx-no-new-function-as-prop (#557): Fixture creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/no-multi-comp (#552): Fixture keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/only-export-components (#553): Fixture is part of a module that also exposes related helpers or framework data; splitting exports requires an API and Fast Refresh boundary decision.
 * typescript/prefer-readonly-parameter-types (#565): Fixture accepts current; slot; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration. */
const Fixture = (): React.JSX.Element => {
  const [log, setLog] = useState<string[]>([]);
  const [selected, setSelected] = useState("comparison-a");
  const append = (value: string): void =>
    setLog((current) => [...current, value]);
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
          // oxlint-disable-next-line oxc/no-map-spread -- #541: Attach this fixture instance's handlers without mutating shared comparison slots.
          slots={comparisonSlots.map((slot) => ({
            // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing slot own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
            ...slot,
            handleSelect: (): void => setSelected(slot.id),
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-array-as-prop, react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, react/only-export-components, typescript/prefer-readonly-parameter-types */

const root = document.querySelector("#root");
if (!root) {
  throw new Error("Missing fixture root");
}
createRoot(root).render(<Fixture />);
