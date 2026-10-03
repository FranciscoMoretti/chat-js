"use client";

import type { ChatStatus } from "ai";
import {
  CornerDownLeftIcon,
  Loader2Icon,
  MicIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import React, {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ComponentProps, HTMLAttributes, RefObject } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- PromptInputHoverCard: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const PromptInputHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  ...props
}: PromptInputHoverCardProps): React.JSX.Element => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputHoverCardContent: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const PromptInputHoverCardContent = ({
  align = "start",
  ...props
}: PromptInputHoverCardContentProps): React.JSX.Element => (
  <HoverCardContent align={align} {...props} />
);
/* oxlint-enable import/exports-last, import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

/** Presentation only: draft submission and file state belong to the composer. */
export type PromptInputProps = HTMLAttributes<HTMLFormElement> & {
  inputGroupClassName?: string;
};
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInput: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const PromptInput = ({
  className,
  inputGroupClassName,
  children,
  ...props
}: PromptInputProps): React.JSX.Element => (
  <form className={cn("w-full", className)} {...props}>
    <InputGroup className={cn("overflow-hidden", inputGroupClassName)}>
      {children}
    </InputGroup>
  </form>
);
/* oxlint-enable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputHeaderProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputHeader: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputHeaderProps). */

export const PromptInputHeader = ({
  className,
  ...props
}: PromptInputHeaderProps): React.JSX.Element => (
  <InputGroupAddon
    align="block-end"
    className={cn("order-first flex-wrap gap-1", className)}
    {...props}
  />
);
/* oxlint-enable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputFooterProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputFooter: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputFooterProps). */

export const PromptInputFooter = ({
  className,
  ...props
}: PromptInputFooterProps): React.JSX.Element => (
  <InputGroupAddon
    align="block-end"
    className={cn("justify-between gap-1", className)}
    {...props}
  />
);
/* oxlint-enable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputToolsProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTools: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputToolsProps). */

export const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);
/* oxlint-enable import/exports-last, import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputButtonProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- PromptInputButton: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps) => {
  const newSize =
    // oxlint-disable-next-line react/no-react-children -- Preserve React child-count semantics for the public button sizing API.
    size ?? (Children.count(props.children) > 1 ? "sm" : "icon-sm");

  return (
    <InputGroupButton
      className={cn(className)}
      size={newSize}
      type="button"
      variant={variant}
      {...props}
    />
  );
};
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputActionMenuProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputActionMenu: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: PromptInputActionMenuProps). */
export const PromptInputActionMenu = (
  props: PromptInputActionMenuProps
): React.JSX.Element => <DropdownMenu {...props} />;
/* oxlint-enable import/exports-last, import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputActionMenuTriggerProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputActionMenuTriggerProps = PromptInputButtonProps;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputActionMenuTrigger: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const PromptInputActionMenuTrigger = ({
  className,
  children,
  ...props
}: PromptInputActionMenuTriggerProps): React.JSX.Element => (
  <DropdownMenuTrigger asChild>
    <PromptInputButton className={className} {...props}>
      {children ?? <PlusIcon className="size-4" />}
    </PromptInputButton>
  </DropdownMenuTrigger>
);
/* oxlint-enable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputActionMenuContentProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputActionMenuContent: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputActionMenuContentProps). */
export const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps): React.JSX.Element => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);
/* oxlint-enable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputActionMenuItemProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputActionMenuItemProps = ComponentProps<
  typeof DropdownMenuItem
>;
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputActionMenuItem: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputActionMenuItemProps). */
export const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps): React.JSX.Element => (
  <DropdownMenuItem className={cn(className)} {...props} />
);
/* oxlint-enable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/exports-last, import/group-exports -- PromptInputSubmitProps: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
};
/* oxlint-enable import/exports-last, import/group-exports */

/* oxlint-disable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- PromptInputSubmit: import/exports-last: keep this public declaration beside its implementation so its props and behavior remain reviewable together; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  children,
  ...props
}: PromptInputSubmitProps) => {
  let Icon = <CornerDownLeftIcon className="size-4" />;

  if (status === "submitted") {
    Icon = <Loader2Icon className="size-4 animate-spin" />;
  } else if (status === "streaming") {
    Icon = <SquareIcon className="size-4" />;
  } else if (status === "error") {
    Icon = <XIcon className="size-4" />;
  }

  return (
    <InputGroupButton
      aria-label="Submit"
      className={cn(className)}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {children ?? Icon}
    </InputGroupButton>
  );
};
/* oxlint-enable import/exports-last, import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- SpeechRecognition: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including this: SpeechRecognition). */

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
  onend: ((this: SpeechRecognition, ev: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void)
    | null;
  onerror:
    | ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void)
    | null;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item: (index: number) => SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item: (index: number) => SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
/* oxlint-disable import/group-exports -- PromptInputSpeechButtonProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputSpeechButtonProps = ComponentProps<
  typeof PromptInputButton
> & {
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onTranscriptionChange?: (text: string) => void;
};
/* oxlint-enable import/group-exports */
/* oxlint-disable id-length, import/group-exports, max-lines-per-function, max-statements, no-console, no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- PromptInputSpeechButton: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including window.SpeechRecognition); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const PromptInputSpeechButton = ({
  className,
  textareaRef,
  onTranscriptionChange,
  ...props
}: PromptInputSpeechButtonProps) => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(
    null
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    if (
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
      typeof window !== "undefined" &&
      // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Speech recognition constructors are declared on the browser Window augmentation.
      ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      const SpeechRecognition =
        // oxlint-disable-next-line unicorn/prefer-global-this -- #572: Speech recognition constructors are declared on the browser Window augmentation.
        window.SpeechRecognition || window.webkitSpeechRecognition;
      const speechRecognition = new SpeechRecognition();

      speechRecognition.continuous = true;
      speechRecognition.interimResults = true;
      speechRecognition.lang = "en-US";

      speechRecognition.onstart = () => {
        setIsListening(true);
      };

      speechRecognition.onend = () => {
        setIsListening(false);
      };

      speechRecognition.onresult = (event) => {
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0]?.transcript ?? "";
          }
        }

        if (finalTranscript && textareaRef?.current) {
          const textarea = textareaRef.current;
          const currentValue = textarea.value;
          const newValue =
            currentValue + (currentValue ? " " : "") + finalTranscript;

          textarea.value = newValue;
          textarea.dispatchEvent(new Event("input", { bubbles: true }));
          onTranscriptionChange?.(newValue);
        }
      };

      speechRecognition.addEventListener("error", (event) => {
        console.error("Speech recognition error:", event);
        setIsListening(false);
      });

      recognitionRef.current = speechRecognition;
      // oxlint-disable-next-line react/set-state-in-effect -- Publish the browser speech-recognition instance after setup.
      setRecognition(speechRecognition);
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [textareaRef, onTranscriptionChange]);

  const toggleListening = useCallback(() => {
    if (!recognition) {
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }, [recognition, isListening]);

  return (
    <PromptInputButton
      className={cn(
        "relative transition-all duration-200",
        isListening && "bg-accent text-accent-foreground animate-pulse",
        className
      )}
      disabled={!recognition}
      onClick={toggleListening}
      {...props}
    >
      <MicIcon className="size-4" />
    </PromptInputButton>
  );
};
/* oxlint-enable id-length, import/group-exports, max-lines-per-function, max-statements, no-console, no-magic-numbers, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

/* oxlint-disable import/group-exports -- PromptInputSelectProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputSelectProps = ComponentProps<typeof Select>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelect: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: PromptInputSelectProps). */

export const PromptInputSelect = (
  props: PromptInputSelectProps
): React.JSX.Element => <Select {...props} />;
/* oxlint-enable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputSelectTriggerProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputSelectTriggerProps = ComponentProps<
  typeof SelectTrigger
>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelectTrigger: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputSelectTriggerProps). */

export const PromptInputSelectTrigger = ({
  className,
  ...props
}: PromptInputSelectTriggerProps): React.JSX.Element => (
  <SelectTrigger
    className={cn(
      "text-muted-foreground border-none bg-transparent font-medium shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className
    )}
    {...props}
  />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputSelectContentProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputSelectContentProps = ComponentProps<
  typeof SelectContent
>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelectContent: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputSelectContentProps). */

export const PromptInputSelectContent = ({
  className,
  ...props
}: PromptInputSelectContentProps): React.JSX.Element => (
  <SelectContent className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputSelectItemProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelectItem: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputSelectItemProps). */

export const PromptInputSelectItem = ({
  className,
  ...props
}: PromptInputSelectItemProps): React.JSX.Element => (
  <SelectItem className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputSelectValueProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelectValue: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputSelectValueProps). */

export const PromptInputSelectValue = ({
  className,
  ...props
}: PromptInputSelectValueProps): React.JSX.Element => (
  <SelectValue className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputHoverCardProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- PromptInputHoverCardTriggerProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputHoverCardTriggerProps = ComponentProps<
  typeof HoverCardTrigger
>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputHoverCardTrigger: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: PromptInputHoverCardTriggerProps). */

export const PromptInputHoverCardTrigger = (
  props: PromptInputHoverCardTriggerProps
): React.JSX.Element => <HoverCardTrigger {...props} />;
/* oxlint-enable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputHoverCardContentProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputHoverCardContentProps = ComponentProps<
  typeof HoverCardContent
>;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- PromptInputTabsListProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTabsList: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabsListProps). */

export const PromptInputTabsList = ({
  className,
  ...props
}: PromptInputTabsListProps): React.JSX.Element => (
  <div className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputTabProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputTabProps = HTMLAttributes<HTMLDivElement>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTab: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabProps). */

export const PromptInputTab = ({
  className,
  ...props
}: PromptInputTabProps): React.JSX.Element => (
  <div className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputTabLabelProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputTabLabelProps = HTMLAttributes<HTMLHeadingElement>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTabLabel: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabLabelProps). */

export const PromptInputTabLabel = ({
  className,
  ...props
}: PromptInputTabLabelProps): React.JSX.Element => (
  <>
    {/* oxlint-disable-next-line jsx-a11y/heading-has-content -- Shared primitive forwards heading children through props. */}
    <h3
      className={cn(
        "text-muted-foreground mb-2 px-3 text-xs font-medium",
        className
      )}
      {...props}
    />
  </>
);
/* oxlint-enable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputTabBodyProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputTabBodyProps = HTMLAttributes<HTMLDivElement>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTabBody: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabBodyProps). */

export const PromptInputTabBody = ({
  className,
  ...props
}: PromptInputTabBodyProps): React.JSX.Element => (
  <div className={cn("space-y-1", className)} {...props} />
);
/* oxlint-enable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputTabItemProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputTabItemProps = HTMLAttributes<HTMLDivElement>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTabItem: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabItemProps). */

export const PromptInputTabItem = ({
  className,
  ...props
}: PromptInputTabItemProps): React.JSX.Element => (
  <div
    className={cn(
      "hover:bg-accent flex items-center gap-2 px-3 py-2 text-xs",
      className
    )}
    {...props}
  />
);
/* oxlint-enable import/group-exports, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputCommandProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputCommandProps = ComponentProps<typeof Command>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommand: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandProps). */

export const PromptInputCommand = ({
  className,
  ...props
}: PromptInputCommandProps): React.JSX.Element => (
  <Command className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputCommandInputProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandInput: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandInputProps). */

export const PromptInputCommandInput = ({
  className,
  ...props
}: PromptInputCommandInputProps): React.JSX.Element => (
  <CommandInput className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputCommandListProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputCommandListProps = ComponentProps<typeof CommandList>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandList: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandListProps). */

export const PromptInputCommandList = ({
  className,
  ...props
}: PromptInputCommandListProps): React.JSX.Element => (
  <CommandList className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputCommandEmptyProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandEmpty: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandEmptyProps). */

export const PromptInputCommandEmpty = ({
  className,
  ...props
}: PromptInputCommandEmptyProps): React.JSX.Element => (
  <CommandEmpty className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputCommandGroupProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandGroup: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandGroupProps). */

export const PromptInputCommandGroup = ({
  className,
  ...props
}: PromptInputCommandGroupProps): React.JSX.Element => (
  <CommandGroup className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputCommandItemProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandItem: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandItemProps). */

export const PromptInputCommandItem = ({
  className,
  ...props
}: PromptInputCommandItemProps): React.JSX.Element => (
  <CommandItem className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports -- PromptInputCommandSeparatorProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export type PromptInputCommandSeparatorProps = ComponentProps<
  typeof CommandSeparator
>;
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandSeparator: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandSeparatorProps). */

export const PromptInputCommandSeparator = ({
  className,
  ...props
}: PromptInputCommandSeparatorProps): React.JSX.Element => (
  <CommandSeparator className={cn(className)} {...props} />
);
/* oxlint-enable import/group-exports, react/forbid-component-props, react/jsx-props-no-spreading, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- prompt-input keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
