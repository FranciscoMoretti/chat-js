"use client";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import React, { memo, useEffect, useRef } from "react";

interface EditorProps {
  content: string;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  isReadonly?: boolean;
  language?: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
}

/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
const getLanguageExtension = (language: string) => {
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
/* oxlint-enable typescript/explicit-function-return-type */

/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
/* oxlint-disable typescript/strict-boolean-expressions -- This value-producing condition preserves the current nullish/empty sentinel behavior; coercing it would change the returned value. */
const PureCodeEditor = ({
  content,
  onSaveContent,
  isReadonly,
  language = "python",
}: EditorProps) => {
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
    editorRef.current?.dispatch({
      effects: configuration.current.reconfigure([
        getLanguageExtension(language),
        EditorView.editable.of(!(isReadonly === true)),
        EditorState.readOnly.of(Boolean(isReadonly)),
        EditorView.updateListener.of((update): void => {
          if (
            update.docChanged &&
            isReadonly !== true &&
            update.transactions.some(
              (transaction): boolean =>
                !transaction.annotation(Transaction.remote)
            )
          ) {
            onSaveContent(update.state.doc.toString(), true);
          }
        }),
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable eslint/max-statements -- These statements express one ordered operation with shared validation and cleanup; preserve the existing sequencing. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const areEqual = (prevProps: EditorProps, nextProps: EditorProps): boolean => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/max-statements */

export const CodeEditor = memo(PureCodeEditor, areEqual);
