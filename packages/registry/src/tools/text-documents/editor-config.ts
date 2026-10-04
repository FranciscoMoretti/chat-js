import { CodeHighlightNode, CodeNode } from "@lexical/code";
import { LinkNode } from "@lexical/link";
import { ListItemNode, ListNode } from "@lexical/list";
import { $convertToMarkdownString, TRANSFORMERS } from "@lexical/markdown";
import { HeadingNode, QuoteNode } from "@lexical/rich-text";
import type { EditorState, LexicalEditor } from "lexical";

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable eslint/no-console -- This is the explicit command-line or library error-reporting boundary; writing to the console is the intended observable output. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
// Create initial editor configuration
const createEditorConfig = () => ({
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
  onError: (error: Error): void => {
    console.error("Lexical error:", error);
  },
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable eslint/no-console */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const handleEditorChange = ({
  editorState: _editorState,
  editor,
  onSaveContent,
}: {
  editorState: EditorState;
  editor: LexicalEditor;
  onSaveContent: (updatedContent: string, debounce: boolean) => void;
}): void => {
  let updatedContent = "";

  editor.getEditorState().read((): void => {
    updatedContent = $convertToMarkdownString(TRANSFORMERS);
  });

  // Check if this should be debounced (similar to ProseMirror's no-debounce meta)
  // Default to debounced saving
  const shouldDebounce = true;

  onSaveContent(updatedContent, shouldDebounce);
};
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export { createEditorConfig, handleEditorChange };
