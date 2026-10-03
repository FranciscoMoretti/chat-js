"use client";

import {
  $convertFromMarkdownString,
  $convertToMarkdownString,
  TRANSFORMERS,
} from "@lexical/markdown";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
/* oxlint-enable eslint/sort-imports */
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
/* oxlint-enable eslint/sort-imports */
import { ListPlugin } from "@lexical/react/LexicalListPlugin";
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
/* oxlint-disable import/max-dependencies -- This integration composes its explicit adapters here; splitting the imports would hide the dependency boundary without reducing dependencies. */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { EditorState } from "lexical";
/* oxlint-enable eslint/sort-imports */
/* oxlint-enable import/max-dependencies */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { $getRoot } from "lexical";
/* oxlint-enable eslint/sort-imports */
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { memo, useEffect, useRef } from "react";
/* oxlint-enable eslint/sort-imports */

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { createEditorConfig, handleEditorChange } from "./editor-config";
/* oxlint-enable eslint/sort-imports */

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
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// Content update plugin
const ContentUpdatePlugin = ({
  content,
  status,
  onSaveContent,
  isReadonly,
}: {
  content: string;
  status: "streaming" | "idle";
  onSaveContent: (content: string, debounce: boolean) => void;
  isReadonly?: boolean;
}) => {
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

  const handleChange = (editorState: EditorState): void => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable eslint/max-lines-per-function */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable oxc/no-rest-spread-properties -- Copying these properties preserves immutable updates and the existing structural API without mutating the source object. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react-perf/jsx-no-new-object-as-prop -- This prop reflects the current render values; preserve the existing update behavior rather than add unmeasured memoization. */
/* oxlint-disable react-perf/jsx-no-jsx-as-prop -- This render slot receives the current JSX state; hoisting it would separate the slot from its captured render inputs. */
/* oxlint-disable react/jsx-max-depth -- This nesting expresses the component library composition and accessibility structure; flattening it can change DOM behavior. */
/* oxlint-disable react/forbid-component-props -- The composed UI component exposes this styling prop as part of its supported public API. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const PureEditor = ({
  content,
  onSaveContent,
  status,
  isReadonly,
}: EditorProps) => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/jsx-max-depth */
/* oxlint-enable react-perf/jsx-no-jsx-as-prop */
/* oxlint-enable react-perf/jsx-no-new-object-as-prop */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable oxc/no-rest-spread-properties */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const areEqual = (prevProps: EditorProps, nextProps: EditorProps): boolean =>
  prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
  prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
  !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
  prevProps.content === nextProps.content &&
  prevProps.onSaveContent === nextProps.onSaveContent &&
  prevProps.isReadonly === nextProps.isReadonly;
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/prefer-default-export -- Keep the named import contract used by registry consumers and package callers even when this module exposes one value. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
export const Editor = memo(PureEditor, areEqual);
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
