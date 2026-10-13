"use client";

import type { InitialConfigType } from "@lexical/react/LexicalComposer";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
} from "lexical";

import type {
  ClipboardEvent,
  KeyboardEvent,
  JSX as ReactJSX,
  RefObject,
} from "react";

import type { EditorState, LexicalEditor } from "lexical";

import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";

import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";

import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";

import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";

import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin";

import { cn } from "@/lib/utils";

import { useAutoFocus } from "@/hooks/use-auto-focus";

import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";

// Plugin to handle Enter key submissions
const EnterKeySubmitPlugin = ({
  onEnterSubmit,
}: {
  readonly onEnterSubmit?: (event: globalThis.KeyboardEvent) => boolean;
}): null => {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerCommand(
        KEY_ENTER_COMMAND,
        (event: globalThis.KeyboardEvent | null) => {
          // Call the custom handler if provided
          if (event && !event.isComposing && onEnterSubmit) {
            const handled = onEnterSubmit(event);
            if (handled) {
              // Prevent the default Enter behavior immediately
              event.preventDefault();
              // Prevent default Enter behavior (adding newline)
              return true;
            }
            // Allow default behavior for non-submit cases (Shift+Enter, etc.)
            return false;
          }
          return false;
        },
        COMMAND_PRIORITY_HIGH
      ),
    [editor, onEnterSubmit]
  );

  return null;
};

// Plugin to get editor instance for imperative ref
const EditorRefPlugin = ({
  setEditor,
}: {
  readonly setEditor: (editor: LexicalEditor) => void;
}): null => {
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
  "aria-label"?: string;
  autoFocus?: boolean;
  className?: string;
  "data-testid"?: string;
  initialValue?: string;
  maxRows?: number;
  onEnterSubmit?: (event: globalThis.KeyboardEvent) => boolean;
  onInputChange?: (value: string) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onPaste?: (event: ClipboardEvent<HTMLDivElement>) => void;
  placeholder?: string;
  readOnly?: boolean;
}

const theme = {
  ltr: "ltr",
  paragraph: "editor-paragraph",
  placeholder: "editor-placeholder",
  root: "lexical-root",
  rtl: "rtl",
};

const onError = (error: Readonly<Error>): void => {
  console.error("Lexical error:", error);
};

const LEXICAL_INITIAL_CONFIG: InitialConfigType = {
  // Accept input only after the editor and its change listeners are mounted.
  editable: false,
  namespace: "LexicalChatInput",
  nodes: [],
  onError,
  theme,
};

const CONTENT_EDITABLE_STYLE: React.CSSProperties = {
  WebkitBoxShadow: "none",
  boxShadow: "none",
};

const LexicalChatInput = ({
  initialValue = "",
  readOnly = false,
  onInputChange,
  onKeyDown,
  onPaste,
  onEnterSubmit,
  placeholder = "Type a message...",
  autoFocus = false,
  className,
  "data-testid": testId,
  "aria-label": ariaLabel,
  ref,
  ..._props
}: LexicalChatInputProps & {
  readonly ref?: RefObject<LexicalChatInputRef | null>;
}): ReactJSX.Element => {
  const [editor, setEditor] = useState<LexicalEditor | null>(null);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useAutoFocus({ autoFocus, editor });

  const handleChange = useCallback(
    (editorState: Readonly<Pick<EditorState, "read">>) => {
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
      clear: (): void => {
        if (editor) {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
          });
        }
      },
      focus: (): void => {
        if (editor) {
          editor.focus();
        }
      },
      getValue: (): string => {
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

  const placeholderElement = (
    <div className="lexical-placeholder text-muted-foreground pointer-events-none absolute pt-2 pl-3">
      {placeholder}
    </div>
  );

  return (
    <LexicalComposer initialConfig={LEXICAL_INITIAL_CONFIG}>
      <div
        className="lexical-editor-container"
        style={{
          borderTop: "0px",
        }}
      >
        <PlainTextPlugin
          contentEditable={
            <ContentEditable
              aria-label={ariaLabel}
              aria-readonly={readOnly}
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
              spellCheck
              style={CONTENT_EDITABLE_STYLE}
            />
          }
          ErrorBoundary={LexicalErrorBoundary}
          placeholder={placeholderElement}
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
export { LexicalChatInput };
export type { LexicalChatInputRef };
