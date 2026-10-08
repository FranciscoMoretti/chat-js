"use client";

import { Compartment, EditorState, Transaction } from "@codemirror/state";
import React, { memo, useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ViewUpdate } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
// oxlint-disable-next-line sort-imports -- CodeMirror modules allocate shared public Facet/provider IDs with nextID++; moving Python, oneDark or basicSetup changes exported language IDs (native control Python 130→135, JavaScript 119→176).
import { oneDark } from "@codemirror/theme-one-dark";
// oxlint-disable-next-line sort-imports -- CodeMirror modules allocate shared public Facet/provider IDs with nextID++; moving Python, oneDark or basicSetup changes exported language IDs (native control Python 130→135, JavaScript 119→176).
import { basicSetup } from "codemirror";

interface EditorProps {
  content: string;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  isReadonly?: boolean;
  language?: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
}

const getLanguageExtension = (language: string): ReturnType<typeof python> => {
  switch (language) {
    case "typescript": {
      return javascript({ jsx: false, typescript: true });
    }
    case "javascript": {
      return javascript({ jsx: false, typescript: false });
    }
    case "jsx": {
      return javascript({ jsx: true, typescript: false });
    }
    case "tsx": {
      return javascript({ jsx: true, typescript: true });
    }
    default: {
      return python();
    }
  }
};
/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const PureCodeEditor = ({
  content,
  onSaveContent,
  isReadonly,
  language = "python",
}: ReadonlyNativeSurface<EditorProps>): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  const configuration = useRef(new Compartment());

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        extensions: [basicSetup, oneDark, configuration.current.of([])],
      }),
    });
    editorRef.current = view;
    // oxlint-disable-next-line typescript/consistent-return -- The effect returns a cleanup only when an editor exists; the inactive branch intentionally has no cleanup.
    return (): void => {
      view.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect((): void => {
    // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when reading dispatch from editorRef.current; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result.
    editorRef.current?.dispatch({
      effects: configuration.current.reconfigure([
        getLanguageExtension(language),
        EditorView.editable.of(!(isReadonly === true)),
        EditorState.readOnly.of(Boolean(isReadonly)),
        EditorView.updateListener.of(
          (
            update: ReadonlyNativeSurface<
              Pick<ViewUpdate, "docChanged" | "state" | "transactions">
            >
          ): void => {
            if (
              update.docChanged &&
              isReadonly !== true &&
              update.transactions.some(
                (transaction: ReadonlyNativeSurface<Transaction>): boolean =>
                  !transaction.annotation(Transaction.remote)
              )
            ) {
              onSaveContent(update.state.doc.toString(), true);
            }
          }
        ),
      ]),
    });
  }, [onSaveContent, isReadonly, language]);

  useEffect((): void => {
    const view = editorRef.current;
    if (!view) {
      return;
    }
    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      view.dispatch({
        annotations: [Transaction.remote.of(true)],
        changes: { from: 0, insert: content, to: currentContent.length },
      });
    }
  }, [content]);

  return (
    <div className="not-prose relative w-full text-sm" ref={containerRef} />
  );
};
/* oxlint-enable typescript/strict-boolean-expressions */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
const areEqual = (
  prevProps: ReadonlyNativeSurface<EditorProps>,
  nextProps: ReadonlyNativeSurface<EditorProps>
): boolean => {
  if (prevProps.currentVersionIndex !== nextProps.currentVersionIndex) {
    return false;
  }
  if (prevProps.isCurrentVersion !== nextProps.isCurrentVersion) {
    return false;
  }
  if (prevProps.status === "streaming" && nextProps.status === "streaming") {
    return false;
  }
  if (prevProps.content !== nextProps.content) {
    return false;
  }
  if (prevProps.isReadonly !== nextProps.isReadonly) {
    return false;
  }
  if (prevProps.language !== nextProps.language) {
    return false;
  }

  return true;
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (CodeEditor); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-enable eslint/max-statements */

export const CodeEditor = memo(PureCodeEditor, areEqual);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
