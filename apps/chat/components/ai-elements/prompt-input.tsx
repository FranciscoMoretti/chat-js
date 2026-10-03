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
/* oxlint-disable no-magic-numbers, typescript/prefer-readonly-parameter-types -- PromptInputHoverCard: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PromptInputHoverCard = ({
  openDelay = 0,
  closeDelay = 0,
  ...props
}: PromptInputHoverCardProps): React.JSX.Element => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);
/* oxlint-enable no-magic-numbers, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputHoverCardContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PromptInputHoverCardContent = ({
  align = "start",
  ...props
}: PromptInputHoverCardContentProps): React.JSX.Element => (
  <HoverCardContent align={align} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/** Presentation only: draft submission and file state belong to the composer. */
type PromptInputProps = HTMLAttributes<HTMLFormElement> & {
  inputGroupClassName?: string;
};

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInput: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PromptInput = ({
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputHeader: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputHeaderProps). */

const PromptInputHeader = ({
  className,
  ...props
}: PromptInputHeaderProps): React.JSX.Element => (
  <InputGroupAddon
    align="block-end"
    className={cn("order-first flex-wrap gap-1", className)}
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputFooter: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputFooterProps). */

const PromptInputFooter = ({
  className,
  ...props
}: PromptInputFooterProps): React.JSX.Element => (
  <InputGroupAddon
    align="block-end"
    className={cn("justify-between gap-1", className)}
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTools: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputToolsProps). */

const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- PromptInputButton: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PromptInputButton = ({
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
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputActionMenu: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: PromptInputActionMenuProps). */
const PromptInputActionMenu = (
  props: PromptInputActionMenuProps
): React.JSX.Element => <DropdownMenu {...props} />;
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputActionMenuTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PromptInputActionMenuTrigger = ({
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputActionMenuContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputActionMenuContentProps). */
const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps): React.JSX.Element => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputActionMenuItemProps = ComponentProps<typeof DropdownMenuItem>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputActionMenuItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputActionMenuItemProps). */
const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps): React.JSX.Element => (
  <DropdownMenuItem className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
};

/* oxlint-disable react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- PromptInputSubmit: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const PromptInputSubmit = ({
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
/* oxlint-enable react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

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

type PromptInputSpeechButtonProps = ComponentProps<typeof PromptInputButton> & {
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  onTranscriptionChange?: (text: string) => void;
};

/* oxlint-disable max-lines-per-function, max-statements, no-console, no-magic-numbers, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- PromptInputSpeechButton: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; max-statements: the ordered state transitions and rendering guards belong to this cohesive feature operation; no-console: retain browser error diagnostics for this caught failure; silently swallowing it removes the existing debugging signal; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including window.SpeechRecognition); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const PromptInputSpeechButton = ({
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

        for (
          let index = event.resultIndex;
          index < event.results.length;
          index += 1
        ) {
          const result = event.results[index];
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
/* oxlint-enable max-lines-per-function, max-statements, no-console, no-magic-numbers, react/no-multi-comp, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

type PromptInputSelectProps = ComponentProps<typeof Select>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelect: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: PromptInputSelectProps). */

const PromptInputSelect = (
  props: PromptInputSelectProps
): React.JSX.Element => <Select {...props} />;
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelectTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputSelectTriggerProps). */

const PromptInputSelectTrigger = ({
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputSelectContentProps = ComponentProps<typeof SelectContent>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelectContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputSelectContentProps). */

const PromptInputSelectContent = ({
  className,
  ...props
}: PromptInputSelectContentProps): React.JSX.Element => (
  <SelectContent className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelectItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputSelectItemProps). */

const PromptInputSelectItem = ({
  className,
  ...props
}: PromptInputSelectItemProps): React.JSX.Element => (
  <SelectItem className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputSelectValue: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputSelectValueProps). */

const PromptInputSelectValue = ({
  className,
  ...props
}: PromptInputSelectValueProps): React.JSX.Element => (
  <SelectValue className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>;

type PromptInputHoverCardTriggerProps = ComponentProps<typeof HoverCardTrigger>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputHoverCardTrigger: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including props: PromptInputHoverCardTriggerProps). */

const PromptInputHoverCardTrigger = (
  props: PromptInputHoverCardTriggerProps
): React.JSX.Element => <HoverCardTrigger {...props} />;
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputHoverCardContentProps = ComponentProps<typeof HoverCardContent>;

type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTabsList: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabsListProps). */

const PromptInputTabsList = ({
  className,
  ...props
}: PromptInputTabsListProps): React.JSX.Element => (
  <div className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputTabProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTab: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabProps). */

const PromptInputTab = ({
  className,
  ...props
}: PromptInputTabProps): React.JSX.Element => (
  <div className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputTabLabelProps = HTMLAttributes<HTMLHeadingElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTabLabel: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabLabelProps). */

const PromptInputTabLabel = ({
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputTabBodyProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTabBody: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabBodyProps). */

const PromptInputTabBody = ({
  className,
  ...props
}: PromptInputTabBodyProps): React.JSX.Element => (
  <div className={cn("space-y-1", className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputTabItemProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputTabItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputTabItemProps). */

const PromptInputTabItem = ({
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputCommandProps = ComponentProps<typeof Command>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommand: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandProps). */

const PromptInputCommand = ({
  className,
  ...props
}: PromptInputCommandProps): React.JSX.Element => (
  <Command className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandInput: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandInputProps). */

const PromptInputCommandInput = ({
  className,
  ...props
}: PromptInputCommandInputProps): React.JSX.Element => (
  <CommandInput className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputCommandListProps = ComponentProps<typeof CommandList>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandList: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandListProps). */

const PromptInputCommandList = ({
  className,
  ...props
}: PromptInputCommandListProps): React.JSX.Element => (
  <CommandList className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandEmpty: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandEmptyProps). */

const PromptInputCommandEmpty = ({
  className,
  ...props
}: PromptInputCommandEmptyProps): React.JSX.Element => (
  <CommandEmpty className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandGroup: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandGroupProps). */

const PromptInputCommandGroup = ({
  className,
  ...props
}: PromptInputCommandGroupProps): React.JSX.Element => (
  <CommandGroup className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandItem: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandItemProps). */

const PromptInputCommandItem = ({
  className,
  ...props
}: PromptInputCommandItemProps): React.JSX.Element => (
  <CommandItem className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type PromptInputCommandSeparatorProps = ComponentProps<typeof CommandSeparator>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- PromptInputCommandSeparator: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: PromptInputCommandSeparatorProps). */

const PromptInputCommandSeparator = ({
  className,
  ...props
}: PromptInputCommandSeparatorProps): React.JSX.Element => (
  <CommandSeparator className={cn(className)} {...props} />
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable max-lines -- prompt-input keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
export {
  PromptInput,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
  PromptInputActionMenuTrigger,
  PromptInputButton,
  PromptInputCommand,
  PromptInputCommandEmpty,
  PromptInputCommandGroup,
  PromptInputCommandInput,
  PromptInputCommandItem,
  PromptInputCommandList,
  PromptInputCommandSeparator,
  PromptInputFooter,
  PromptInputHeader,
  PromptInputHoverCard,
  PromptInputHoverCardContent,
  PromptInputHoverCardTrigger,
  PromptInputSelect,
  PromptInputSelectContent,
  PromptInputSelectItem,
  PromptInputSelectTrigger,
  PromptInputSelectValue,
  PromptInputSpeechButton,
  PromptInputSubmit,
  PromptInputTab,
  PromptInputTabBody,
  PromptInputTabItem,
  PromptInputTabLabel,
  PromptInputTabsList,
  PromptInputTools,
};
export type {
  PromptInputActionMenuContentProps,
  PromptInputActionMenuItemProps,
  PromptInputActionMenuProps,
  PromptInputActionMenuTriggerProps,
  PromptInputButtonProps,
  PromptInputCommandEmptyProps,
  PromptInputCommandGroupProps,
  PromptInputCommandInputProps,
  PromptInputCommandItemProps,
  PromptInputCommandListProps,
  PromptInputCommandProps,
  PromptInputCommandSeparatorProps,
  PromptInputFooterProps,
  PromptInputHeaderProps,
  PromptInputHoverCardContentProps,
  PromptInputHoverCardProps,
  PromptInputHoverCardTriggerProps,
  PromptInputProps,
  PromptInputSelectContentProps,
  PromptInputSelectItemProps,
  PromptInputSelectProps,
  PromptInputSelectTriggerProps,
  PromptInputSelectValueProps,
  PromptInputSpeechButtonProps,
  PromptInputSubmitProps,
  PromptInputTabBodyProps,
  PromptInputTabItemProps,
  PromptInputTabLabelProps,
  PromptInputTabProps,
  PromptInputTabsListProps,
  PromptInputToolsProps,
};
