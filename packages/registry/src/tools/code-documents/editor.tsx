"use client";

import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { Compartment, EditorState, Transaction } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { basicSetup } from "codemirror";
import { memo, useEffect, useRef } from "react";

interface EditorProps {
  content: string;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  isReadonly?: boolean;
  language?: string;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
}

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
    return () => {
      view.destroy();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    editorRef.current?.dispatch({
      effects: configuration.current.reconfigure([
        getLanguageExtension(language),
        EditorView.editable.of(!isReadonly),
        EditorState.readOnly.of(Boolean(isReadonly)),
        EditorView.updateListener.of((update) => {
          if (
            update.docChanged &&
            !isReadonly &&
            update.transactions.some(
              (transaction) => !transaction.annotation(Transaction.remote)
            )
          ) {
            onSaveContent(update.state.doc.toString(), true);
          }
        }),
      ]),
    });
  }, [onSaveContent, isReadonly, language]);

  useEffect(() => {
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

const areEqual = (prevProps: EditorProps, nextProps: EditorProps) => {
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
