import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { ListItemNode, ListNode } from "@lexical/list";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
/* oxlint-enable sort-imports */
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { EditorState, LexicalEditor } from "lexical";
/* oxlint-enable sort-imports */

const DOCUMENT_NODE_CLASSES = [
  HeadingNode,
  ListNode,
  ListItemNode,
  QuoteNode,
  CodeNode,
  CodeHighlightNode,
  LinkNode,
];
interface DocumentEditorConfig {
  namespace: string;
  nodes: typeof DOCUMENT_NODE_CLASSES;
  onError: (error: Readonly<Error>) => void;
}

// Create initial editor configuration with a fresh node collection for each editor.
const createEditorConfig = (): DocumentEditorConfig => ({
  namespace: "DocumentEditor",
  nodes: [...DOCUMENT_NODE_CLASSES],
  onError: (error: Readonly<Error>): void => {
    // oxlint-disable-next-line eslint/no-console -- Preserve Lexical's configured error-reporting boundary: every editor error is reported with its native Error object.
    console.error("Lexical error:", error);
  },
});

const handleEditorChange = ({
  editorState: _editorState,
  editor,
  onSaveContent,
}: Readonly<{
  editorState: Readonly<Pick<EditorState, "read">>;
  editor: Readonly<Pick<LexicalEditor, "getEditorState">>;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}>): void => {
  let updatedContent = "";

  editor.getEditorState().read((): void => {
    updatedContent = $convertToMarkdownString(TRANSFORMERS);
  });

  // Check if this should be debounced (similar to ProseMirror's no-debounce meta)
  // Default to debounced saving
  const shouldDebounce = true;

  onSaveContent(updatedContent, shouldDebounce);
};
export { createEditorConfig, handleEditorChange };
