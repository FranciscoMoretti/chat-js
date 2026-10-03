"use client";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { Compartment, EditorState, Transaction } from "@codemirror/state";
/* oxlint-enable eslint/sort-imports */
import { oneDark } from "@codemirror/theme-one-dark";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { EditorView } from "@codemirror/view";
/* oxlint-enable eslint/sort-imports */
import { basicSetup } from "codemirror";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { memo, useEffect, useRef } from "react";
/* oxlint-enable eslint/sort-imports */

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
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable unicorn/max-nested-calls -- Keep this data transformation together so its argument evaluation order and contextual type inference remain explicit. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
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
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable unicorn/max-nested-calls */
/* oxlint-enable oxc/no-optional-chaining */
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

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const CodeEditor = memo(PureCodeEditor, areEqual);
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
