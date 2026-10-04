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
import React, {
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { ClipboardEvent, KeyboardEvent, RefObject } from "react";

import { useAutoFocus } from "@/hooks/use-auto-focus";
/* oxlint-disable import/max-dependencies -- @/lib/utils import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { cn } from "@/lib/utils";
/* oxlint-enable import/max-dependencies */

/* oxlint-disable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EnterKeySubmitPlugin: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: globalThis.KeyboardEvent); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

// Plugin to handle Enter key submissions
const EnterKeySubmitPlugin = ({
  onEnterSubmit,
}: {
  onEnterSubmit?: (event: globalThis.KeyboardEvent) => boolean;
}) => {
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */
/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null -- EditorRefPlugin: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including editor: LexicalEditor); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, typescript/prefer-readonly-parameter-types, unicorn/no-null */

interface LexicalChatInputRef {
  clear: () => void;
  focus: () => void;
  getValue: () => string;
}
/* oxlint-disable typescript/prefer-readonly-parameter-types -- LexicalChatInputProps: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event: globalThis.KeyboardEvent). */

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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

const theme = {
  ltr: "ltr",
  paragraph: "editor-paragraph",
  placeholder: "editor-placeholder",
  root: "lexical-root",
  rtl: "rtl",
};
/* oxlint-disable no-console, typescript/prefer-readonly-parameter-types -- onError: no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including error: Error). */

const onError = (error: Error): void => {
  console.error("Lexical error:", error);
};
/* oxlint-enable no-console, typescript/prefer-readonly-parameter-types */
/* oxlint-disable max-lines-per-function, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- LexicalChatInput: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-undefined: undefined preserves the optional prop, cache, or missing-value contract; null is a different value; react-perf/jsx-no-jsx-as-prop: this component composition slot accepts an element from the current render; react-perf/jsx-no-new-object-as-prop: this prop object derives from current render state or feature styling; hoisting changes its ownership; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including editorState: EditorState); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

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
  ref?: RefObject<LexicalChatInputRef | null>;
}) => {
  const [editor, setEditor] = useState<LexicalEditor | null>(null);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  useAutoFocus({ autoFocus, editor });

  const initialConfig: InitialConfigType = {
    // Accept input only after the editor and its change listeners are mounted.
    editable: false,
    namespace: "LexicalChatInput",
    nodes: [],
    onError,
    theme,
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
      clear: () => {
        if (editor) {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
          });
        }
      },
      focus: () => {
        if (editor) {
          editor.focus();
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

  const placeholderElement = (
    <div className="lexical-placeholder text-muted-foreground pointer-events-none absolute pt-2 pl-3">
      {placeholder}
    </div>
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
              style={{
                // oxlint-disable-next-line typescript/no-deprecated -- #583: Keep the Firefox-specific focus appearance override until browser rendering verifies its removal.
                MozBoxShadow: "none",
                WebkitBoxShadow: "none",
                boxShadow: "none",
              }}
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
/* oxlint-enable max-lines-per-function, no-undefined, react-perf/jsx-no-jsx-as-prop, react-perf/jsx-no-new-object-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

LexicalChatInput.displayName = "LexicalChatInput";
export { LexicalChatInput };
export type { LexicalChatInputRef };
