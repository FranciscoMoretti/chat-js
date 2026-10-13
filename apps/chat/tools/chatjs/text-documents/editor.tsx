"use client";

import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import React, { memo, useEffect, useRef } from "react";
import { createEditorConfig, handleEditorChange } from "./editor-config";
import { $getRoot } from "lexical";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import type { EditorState } from "lexical";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

interface EditorProps {
  content: string;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  isReadonly?: boolean;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
}

// Content update plugin
const ContentUpdatePlugin = ({
  content,
  status,
  onSaveContent,
  isReadonly,
}: ReadonlyNativeSurface<{
  content: string;
  status: "streaming" | "idle";
  onSaveContent: (content: string, debounce: boolean) => void;
  isReadonly?: boolean;
}>): React.JSX.Element => {
  const [editor] = useLexicalComposerContext();
  const isProgrammaticUpdate = useRef(false);

  useEffect((): void => {
    editor.setEditable(!(isReadonly === true));
  }, [editor, isReadonly]);

  useEffect((): void => {
    let currentMarkdown = "";
    editor.getEditorState().read((): void => {
      currentMarkdown = $convertToMarkdownString(TRANSFORMERS);
    });
    if (status !== "streaming" && currentMarkdown.trim() === content.trim()) {
      return;
    }
    isProgrammaticUpdate.current = true;
    editor.update(
      (): void => {
        $getRoot().clear();
        $convertFromMarkdownString(content);
      },
      {
        discrete: true,
        onUpdate: (): void => {
          isProgrammaticUpdate.current = false;
        },
      }
    );
  }, [content, status, editor]);

  const handleChange = (
    editorState: Readonly<Pick<EditorState, "read">>
  ): void => {
    if (!(isReadonly === true || isProgrammaticUpdate.current)) {
      handleEditorChange({
        editor,
        editorState,
        onSaveContent,
      });
    }
  };

  return <OnChangePlugin onChange={handleChange} />;
};

const PureEditor = ({
  content,
  onSaveContent,
  status,
  isReadonly,
}: ReadonlyNativeSurface<EditorProps>): React.JSX.Element => {
  const initialConfig = createEditorConfig();

  const editorConfig = {
    ...initialConfig,
    editable: !(isReadonly === true),
  };

  return (
    <div className="prose dark:prose-invert relative text-left">
      <LexicalComposer initialConfig={editorConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable className="lexical-editor text-left outline-hidden" />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={
            <div className="text-muted-foreground">Start typing...</div>
          }
        />
        <HistoryPlugin />
        <ListPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <ContentUpdatePlugin
          content={content}
          isReadonly={isReadonly}
          onSaveContent={onSaveContent}
          status={status}
        />
      </LexicalComposer>
    </div>
  );
};

const areEqual = (
  prevProps: ReadonlyNativeSurface<EditorProps>,
  nextProps: ReadonlyNativeSurface<EditorProps>
): boolean =>
  prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
  prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
  !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
  prevProps.content === nextProps.content &&
  prevProps.onSaveContent === nextProps.onSaveContent &&
  prevProps.isReadonly === nextProps.isReadonly;

export const Editor = memo(PureEditor, areEqual);
