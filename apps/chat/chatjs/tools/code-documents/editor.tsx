"use client";

import { Compartment, EditorState, Transaction } from "@codemirror/state";
import React, { memo, useEffect, useRef } from "react";
import { EditorView } from "@codemirror/view";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import type { ViewUpdate } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";
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

const PureCodeEditor = ({
  content,
  onSaveContent,
  isReadonly,
  language = "python",
}: ReadonlyNativeSurface<EditorProps>): React.JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<EditorView | null>(null);

  const configuration = useRef(new Compartment());

  useEffect((): (() => void) | undefined => {
    if (!containerRef.current) {
      return undefined;
    }
    const view = new EditorView({
      parent: containerRef.current,
      state: EditorState.create({
        extensions: [basicSetup, oneDark, configuration.current.of([])],
      }),
    });
    editorRef.current = view;
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
                  transaction.annotation(Transaction.remote) !== true
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

export const CodeEditor = memo(PureCodeEditor, areEqual);
