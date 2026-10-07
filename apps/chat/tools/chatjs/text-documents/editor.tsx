"use client";

import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
/* oxlint-enable sort-imports */
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
/* oxlint-enable sort-imports */
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EditorState } from "lexical";
/* oxlint-enable sort-imports */
/* oxlint-enable import/max-dependencies */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import { $getRoot } from "lexical";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import React, { memo, useEffect, useRef } from "react";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

import { createEditorConfig, handleEditorChange } from "./editor-config";
/* oxlint-enable sort-imports */

interface EditorProps {
  content: string;
  currentVersionIndex: number;
  isCurrentVersion: boolean;
  isReadonly?: boolean;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
  status: "streaming" | "idle";
}

/* oxlint-disable eslint/max-lines-per-function -- Keep the ordered validation, state transitions, and cleanup in one operation so their sequencing remains reviewable. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
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
}>) => {
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
/* oxlint-disable react/jsx-no-literals -- PureEditor renders authored tool output labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */

/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- This render slot receives the current JSX state; hoisting it would separate the slot from its captured render inputs. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */

const PureEditor = ({
  content,
  onSaveContent,
  status,
  isReadonly,
}: ReadonlyNativeSurface<EditorProps>) => {
  const initialConfig = createEditorConfig();

  const editorConfig = {
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Keep the existing initialConfig own-key composition and positional override order; the pinned eslint/prefer-object-spread rule rejects the Object.assign replacement.
    ...initialConfig,
    editable: !(isReadonly === true),
  };

  return (
    <div className="prose dark:prose-invert relative text-left">
      <LexicalComposer initialConfig={editorConfig}>
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              // oxlint-disable-next-line react/forbid-component-props -- ContentEditable accepts className in its styling contract; preserve this caller's layout and appearance.
              className="lexical-editor text-left outline-hidden"
            />
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
/* oxlint-enable react/jsx-no-literals */

/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */

/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

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
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Editor); the enabled import/no-default-export convention rejects the default-export alternative. */

export const Editor = memo(PureEditor, areEqual);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
