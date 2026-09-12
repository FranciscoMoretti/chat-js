"use client";

import { LexicalComposer } from "@lexical/react/LexicalComposer";
import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
} from "lexical";
import type { EditorState, LexicalEditor } from "lexical";
import { useCallback, useEffect, useImperativeHandle, useState } from "react";
import type { ClipboardEvent, KeyboardEvent, RefObject } from "react";

import { useAutoFocus } from "@/hooks/use-auto-focus";
import { cn } from "@/lib/utils";

// Plugin to handle Enter key submissions
const EnterKeySubmitPlugin = ({
  onEnterSubmit,
}: {
  onEnterSubmit?: (event: KeyboardEvent) => boolean;
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event: KeyboardEvent) => {
        // Call the custom handler if provided
        if (onEnterSubmit) {
          const handled = onEnterSubmit(event);
          if (handled) {
            // Prevent the default Enter behavior immediately
            event.preventDefault();
            // Prevent default Enter behavior (adding newline)
            return true;
          }
        }
        // Allow default behavior for non-submit cases (Shift+Enter, etc.)
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, onEnterSubmit]);

  return null;
};

// Plugin to get editor instance for imperative ref
const EditorRefPlugin = ({
  setEditor,
}: {
  setEditor: (editor: LexicalEditor) => void;
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    setEditor(editor);
  }, [editor, setEditor]);

  return null;
};

interface LexicalChatInputRef {
  clear: () => void;
  focus: () => void;
  getValue: () => string;
}

interface LexicalChatInputProps {
  autoFocus?: boolean;
  className?: string;
  "data-testid"?: string;
  initialValue?: string;
  maxRows?: number;
  onEnterSubmit?: (event: KeyboardEvent) => boolean;
  onInputChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
}

const theme = {
  root: "lexical-root",
  ltr: "ltr",
  rtl: "rtl",
  placeholder: "editor-placeholder",
  paragraph: "editor-paragraph",
};

const onError = (error: Error) => {
  console.error("Lexical error:", error);
};

export const LexicalChatInput = ({
  initialValue = "",
  onInputChange,
  onKeyDown,
  onPaste,
  onEnterSubmit,
  placeholder = "Type a message...",
  autoFocus = false,
  className,
  "data-testid": testId,
  ref,
  ..._props
}: LexicalChatInputProps & {
  ref?: RefObject<LexicalChatInputRef | null>;
}) => {
  const [editor, setEditor] = useState<LexicalEditor | null>(null);

  useAutoFocus({ autoFocus, editor });

  const initialConfig: InitialConfigType = {
    namespace: "LexicalChatInput",
    theme,
    onError,
    nodes: [],
  };

  const handleChange = useCallback(
    (editorState: EditorState) => {
      if (onInputChange) {
        editorState.read(() => {
          const root = $getRoot();
          const textContent = root.getTextContent();
          onInputChange(textContent);
        });
      }
    },
    [onInputChange]
  );

  useImperativeHandle(
    ref,
    () => ({
      focus: () => {
        if (editor) {
          editor.focus();
        }
      },
      clear: () => {
        if (editor) {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
          });
        }
      },
      getValue: () => {
        if (editor) {
          return editor.getEditorState().read(() => {
            const root = $getRoot();
            return root.getTextContent();
          });
        }
        return "";
      },
    }),
    [editor]
  );

  // Handle value changes from parent
  useEffect(() => {
    if (editor && initialValue !== undefined) {
      editor.update(() => {
        const root = $getRoot();
        const currentText = root.getTextContent();

        if (currentText !== initialValue) {
          root.clear();
          const paragraph = $createParagraphNode();
          if (initialValue) {
            const textNode = $createTextNode(initialValue);
            paragraph.append(textNode);
          }
          root.append(paragraph);
        }
      });
    }
  }, [editor, initialValue]);

  const PlaceholderComponent = useCallback(
    () => (
      <div className="lexical-placeholder text-muted-foreground pointer-events-none absolute pt-2 pl-3">
        {placeholder}
      </div>
    ),
    [placeholder]
  );

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className="lexical-editor-container"
        style={{
          borderTop: "0px",
        }}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              className={cn(
                "focus:outline-hidden focus-visible:outline-hidden",
                "[&>.lexical-root]:min-h-[20px] [&>.lexical-root]:outline-hidden",
                "lexical-content-editable",
                "editor-input",
                className
              )}
              data-testid={testId}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              spellCheck={true}
              style={{
                WebkitBoxShadow: "none",
                MozBoxShadow: "none",
                boxShadow: "none",
              }}
              // aria-placeholder={placeholder}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={<PlaceholderComponent />}
        />
        <OnChangePlugin onChange={handleChange} />
        <HistoryPlugin />
        <EditorRefPlugin setEditor={setEditor} />
        <EnterKeySubmitPlugin onEnterSubmit={onEnterSubmit} />
      </div>
    </LexicalComposer>
  );
};

LexicalChatInput.displayName = "LexicalChatInput";

export type { LexicalChatInputRef };
