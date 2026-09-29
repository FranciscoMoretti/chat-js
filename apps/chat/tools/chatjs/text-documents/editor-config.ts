import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { EditorState, LexicalEditor } from "lexical";

// Create initial editor configuration
export const createEditorConfig = () => ({
  namespace: "DocumentEditor",
  nodes: [
    HeadingNode,
    ListNode,
    ListItemNode,
    QuoteNode,
    CodeNode,
    CodeHighlightNode,
    LinkNode,
  ],
  onError: (error: Error) => {
    console.error("Lexical error:", error);
  },
});

export const handleEditorChange = ({
  editorState: _editorState,
  editor,
  onSaveContent,
}: {
  editorState: EditorState;
  editor: LexicalEditor;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}) => {
  let updatedContent = "";

  editor.getEditorState().read(() => {
    updatedContent = $convertToMarkdownString(TRANSFORMERS);
  });

  // Check if this should be debounced (similar to ProseMirror's no-debounce meta)
  // Default to debounced saving
  const shouldDebounce = true;

  onSaveContent(updatedContent, shouldDebounce);
};
