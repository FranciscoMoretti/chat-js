"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import type {
  ComponentProps,
  HTMLAttributes,
  JSX as ReactJSX,
  RefObject,
} from "react";
import {
  CornerDownLeftIcon,
  Loader2Icon,
  MicIcon,
  PlusIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
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
import React, {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatStatus } from "ai";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { cn } from "@/lib/utils";

const IMMEDIATE_HOVER_DELAY = 0;
const SINGLE_BUTTON_CHILD = 1;
const SPEECH_RESULT_STEP = 1;
const FIRST_SPEECH_ALTERNATIVE = 0;

const PromptInputHoverCard = ({
  openDelay = IMMEDIATE_HOVER_DELAY,
  closeDelay = IMMEDIATE_HOVER_DELAY,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes openDelay, closeDelay from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: PromptInputHoverCardProps): React.JSX.Element => (
  <HoverCard
    closeDelay={closeDelay}
    openDelay={openDelay}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputHoverCard's HoverCard prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);

/* oxlint-disable react/no-multi-comp -- PromptInputHoverCardContent: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputHoverCardContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputHoverCardContentProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    align = "start",
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes align from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputHoverCardContentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <HoverCardContent
    align={align}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputHoverCardContent's HoverCardContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

/** Presentation only: draft submission and file state belong to the composer. */
type PromptInputProps = HTMLAttributes<HTMLFormElement> & {
  inputGroupClassName?: string;
};

/* oxlint-disable react/no-multi-comp -- PromptInput: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInput = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    inputGroupClassName,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, inputGroupClassName, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <form
    className={cn("w-full", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInput's native form attributes, preserving caller events and accessibility props.
    {...props}
  >
    <InputGroup
      // oxlint-disable-next-line react/forbid-component-props -- InputGroup accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn("overflow-hidden", inputGroupClassName)}
    >
      {children}
    </InputGroup>
  </form>
);
/* oxlint-enable react/no-multi-comp */

type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

/* oxlint-disable react/no-multi-comp -- PromptInputHeader: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputHeader = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputHeaderProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputHeaderProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <InputGroupAddon
    align="block-end"
    // oxlint-disable-next-line react/forbid-component-props -- InputGroupAddon accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("order-first flex-wrap gap-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputHeader's InputGroupAddon prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

/* oxlint-disable react/no-multi-comp -- PromptInputFooter: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputFooter = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputFooterProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputFooterProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <InputGroupAddon
    align="block-end"
    // oxlint-disable-next-line react/forbid-component-props -- InputGroupAddon accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn("justify-between gap-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputFooter's InputGroupAddon prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- PromptInputTools: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputTools = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputToolsProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputToolsProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn("flex items-center gap-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputTools's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;

/* oxlint-disable react/no-multi-comp -- PromptInputButton: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputButton = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputButtonProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    variant = "ghost",
    className,
    size,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes variant, className, size from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputButtonProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const newSize =
    size ??
    // oxlint-disable-next-line react/no-react-children, no-ternary -- The public button accepts opaque ReactNode children: Children.count counts null/boolean array entries, traverses nested arrays, and treats a Fragment as one child; toArray drops empty entries, while array inspection cannot preserve nesting or Fragment semantics. Changing this requires a narrower caller API.; no-ternary: Keep ?? operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    (Children.count(props.children) > SINGLE_BUTTON_CHILD ? "sm" : "icon-sm");

  return (
    <InputGroupButton
      // oxlint-disable-next-line react/forbid-component-props -- InputGroupButton accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(className)}
      size={newSize}
      type="button"
      variant={variant}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputButton's InputGroupButton prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/no-multi-comp */

type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;

/* oxlint-disable react/no-multi-comp -- PromptInputActionMenu: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy. */
const PromptInputActionMenu = (
  props: PromptInputActionMenuProps
): React.JSX.Element => (
  <DropdownMenu
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputActionMenu's DropdownMenu prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

/* oxlint-disable react/no-multi-comp -- PromptInputActionMenuTrigger: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputActionMenuTrigger = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputActionMenuTriggerProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputActionMenuTriggerProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <DropdownMenuTrigger asChild>
    <PromptInputButton
      // oxlint-disable-next-line react/forbid-component-props -- PromptInputButton accepts className in its styling contract; preserve this caller's layout and appearance.
      className={className}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputActionMenuTrigger's PromptInputButton prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children ?? (
        <PlusIcon
          // oxlint-disable-next-line react/forbid-component-props -- PlusIcon accepts className in its styling contract; preserve this caller's layout and appearance.
          className="size-4"
        />
      )}
    </PromptInputButton>
  </DropdownMenuTrigger>
);
/* oxlint-enable react/no-multi-comp */

type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;

/* oxlint-disable react/no-multi-comp -- PromptInputActionMenuContent: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */
const PromptInputActionMenuContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputActionMenuContentProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputActionMenuContentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <DropdownMenuContent
    align="start"
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuContent accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputActionMenuContent's DropdownMenuContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputActionMenuItemProps = ComponentProps<typeof DropdownMenuItem>;

/* oxlint-disable react/no-multi-comp -- PromptInputActionMenuItem: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */
const PromptInputActionMenuItem = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputActionMenuItemProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputActionMenuItemProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <DropdownMenuItem
    // oxlint-disable-next-line react/forbid-component-props -- DropdownMenuItem accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputActionMenuItem's DropdownMenuItem prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
};

/* oxlint-disable react/no-multi-comp -- PromptInputSubmit: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputSubmit = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputSubmitProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    variant = "default",
    size = "icon-sm",
    status,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, variant, size, status, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputSubmitProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  let Icon = (
    <CornerDownLeftIcon
      // oxlint-disable-next-line react/forbid-component-props -- CornerDownLeftIcon accepts className in its styling contract; preserve this caller's layout and appearance.
      className="size-4"
    />
  );

  if (status === "submitted") {
    Icon = (
      <Loader2Icon
        // oxlint-disable-next-line react/forbid-component-props -- Loader2Icon accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-4 animate-spin"
      />
    );
  } else if (status === "streaming") {
    Icon = (
      <SquareIcon
        // oxlint-disable-next-line react/forbid-component-props -- SquareIcon accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-4"
      />
    );
  } else if (status === "error") {
    Icon = (
      <XIcon
        // oxlint-disable-next-line react/forbid-component-props -- XIcon accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-4"
      />
    );
  }

  return (
    <InputGroupButton
      aria-label="Submit"
      // oxlint-disable-next-line react/forbid-component-props -- InputGroupButton accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(className)}
      size={size}
      type="submit"
      variant={variant}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputSubmit's InputGroupButton prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children ?? Icon}
    </InputGroupButton>
  );
};
/* oxlint-enable react/no-multi-comp */

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart:
    | ((
        this: ReadonlyNativeSurface<SpeechRecognition>,
        ev: ReadonlyNativeSurface<Event>
      ) => void)
    | null;
  onend:
    | ((
        this: ReadonlyNativeSurface<SpeechRecognition>,
        ev: ReadonlyNativeSurface<Event>
      ) => void)
    | null;
  onresult:
    | ((
        this: ReadonlyNativeSurface<SpeechRecognition>,
        ev: ReadonlyNativeSurface<SpeechRecognitionEvent>
      ) => void)
    | null;
  onerror:
    | ((
        this: ReadonlyNativeSurface<SpeechRecognition>,
        ev: ReadonlyNativeSurface<SpeechRecognitionErrorEvent>
      ) => void)
    | null;
}

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

type SpeechResultEvent = Readonly<{
  resultIndex: number;
  results: Readonly<
    ArrayLike<
      Readonly<{
        isFinal: boolean;
        readonly [index: number]: Readonly<{ transcript: string }>;
      }>
    >
  >;
}>;

/* oxlint-disable react/no-multi-comp, unicorn/no-null -- PromptInputSpeechButton: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const collectFinalTranscript = (event: SpeechResultEvent): string => {
  let finalTranscript = "";

  for (
    let index = event.resultIndex;
    index < event.results.length;
    index += SPEECH_RESULT_STEP
  ) {
    const result = event.results[index];
    if (result.isFinal) {
      const { [FIRST_SPEECH_ALTERNATIVE]: alternative } = result;
      if (typeof alternative === "object" && alternative !== null) {
        finalTranscript += alternative.transcript;
      }
    }
  }
  return finalTranscript;
};

const initializeSpeechRecognition = (
  SpeechRecognition: new () => SpeechRecognition,
  onResult: NonNullable<SpeechRecognition["onresult"]>,
  setIsListening: (listening: boolean) => void
): SpeechRecognition => {
  const speechRecognition = new SpeechRecognition();

  speechRecognition.continuous = true;
  speechRecognition.interimResults = true;
  speechRecognition.lang = "en-US";

  speechRecognition.onstart = (): void => {
    setIsListening(true);
  };

  speechRecognition.onend = (): void => {
    setIsListening(false);
  };

  speechRecognition.onresult = onResult;

  speechRecognition.addEventListener("error", (event: unknown) => {
    // oxlint-disable-next-line no-console -- Browser speech errors are surfaced through the existing error diagnostic before resetting listening state; reportError would additionally dispatch a global error.
    console.error("Speech recognition error:", event);
    setIsListening(false);
  });
  return speechRecognition;
};

const useSpeechRecognition = (
  onResult: NonNullable<SpeechRecognition["onresult"]>
): Readonly<{
  isListening: boolean;
  recognition: SpeechRecognition | null;
  toggleListening: () => void;
}> => {
  const [isListening, setIsListening] = useState(false);
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(
    null
  );
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  useEffect(() => {
    if (
      "window" in globalThis &&
      ("SpeechRecognition" in globalThis.window ||
        "webkitSpeechRecognition" in globalThis.window)
    ) {
      const SpeechRecognition =
        globalThis.window.SpeechRecognition ??
        globalThis.window.webkitSpeechRecognition;
      const speechRecognition = initializeSpeechRecognition(
        SpeechRecognition,
        onResult,
        setIsListening
      );

      recognitionRef.current = speechRecognition;
      // oxlint-disable-next-line react/set-state-in-effect -- Publish the browser speech-recognition instance after setup.
      setRecognition(speechRecognition);
    }
    return (): void => {
      if (recognitionRef.current !== null) {
        recognitionRef.current.stop();
      }
    };
  }, [onResult]);

  const toggleListening = useCallback(() => {
    if (recognition === null) {
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      recognition.start();
    }
  }, [recognition, isListening]);
  return { isListening, recognition, toggleListening };
};

const PromptInputSpeechButton = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputSpeechButtonProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    textareaRef,
    onTranscriptionChange,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, textareaRef, onTranscriptionChange from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputSpeechButtonProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const onResult = useCallback(
    (event: SpeechResultEvent): void => {
      const finalTranscript = collectFinalTranscript(event);
      if (
        finalTranscript !== "" &&
        typeof textareaRef === "object" &&
        textareaRef.current !== null
      ) {
        const textarea = textareaRef.current;
        const currentValue = textarea.value;
        const newValue =
          // oxlint-disable-next-line no-ternary -- Keep + operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
          currentValue + (currentValue === "" ? "" : " ") + finalTranscript;

        textarea.value = newValue;
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
        if (typeof onTranscriptionChange === "function") {
          onTranscriptionChange(newValue);
        }
      }
    },
    [textareaRef, onTranscriptionChange]
  );
  const { isListening, recognition, toggleListening } =
    useSpeechRecognition(onResult);

  return (
    <PromptInputButton
      // oxlint-disable-next-line react/forbid-component-props -- PromptInputButton accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "relative transition-all duration-200",
        isListening && "bg-accent text-accent-foreground animate-pulse",
        className
      )}
      disabled={!recognition}
      onClick={toggleListening}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputSpeechButton's PromptInputButton prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <MicIcon
        // oxlint-disable-next-line react/forbid-component-props -- MicIcon accepts className in its styling contract; preserve this caller's layout and appearance.
        className="size-4"
      />
    </PromptInputButton>
  );
};
/* oxlint-enable react/no-multi-comp, unicorn/no-null */

type PromptInputSelectProps = ComponentProps<typeof Select>;

/* oxlint-disable react/no-multi-comp -- PromptInputSelect: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputSelect = (
  props: ReadonlyNativeSurface<PromptInputSelectProps>
): React.JSX.Element => (
  <Select
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputSelect's Select prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

/* oxlint-disable react/no-multi-comp -- PromptInputSelectTrigger: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputSelectTrigger = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputSelectTriggerProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputSelectTriggerProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <SelectTrigger
    // oxlint-disable-next-line react/forbid-component-props -- SelectTrigger accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(
      "text-muted-foreground border-none bg-transparent font-medium shadow-none transition-colors",
      "hover:bg-accent hover:text-foreground aria-expanded:bg-accent aria-expanded:text-foreground",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputSelectTrigger's SelectTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputSelectContentProps = ComponentProps<typeof SelectContent>;

/* oxlint-disable react/no-multi-comp -- PromptInputSelectContent: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputSelectContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputSelectContentProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputSelectContentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <SelectContent
    // oxlint-disable-next-line react/forbid-component-props -- SelectContent accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputSelectContent's SelectContent prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;

/* oxlint-disable react/no-multi-comp -- PromptInputSelectItem: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputSelectItem = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputSelectItemProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputSelectItemProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <SelectItem
    // oxlint-disable-next-line react/forbid-component-props -- SelectItem accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputSelectItem's SelectItem prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;

/* oxlint-disable react/no-multi-comp -- PromptInputSelectValue: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputSelectValue = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputSelectValueProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputSelectValueProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <SelectValue
    // oxlint-disable-next-line react/forbid-component-props -- SelectValue accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputSelectValue's SelectValue prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>;

type PromptInputHoverCardTriggerProps = ComponentProps<typeof HoverCardTrigger>;

/* oxlint-disable react/no-multi-comp -- PromptInputHoverCardTrigger: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputHoverCardTrigger = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputHoverCardTriggerProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  props: PromptInputHoverCardTriggerProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <HoverCardTrigger
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputHoverCardTrigger's HoverCardTrigger prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputHoverCardContentProps = ComponentProps<typeof HoverCardContent>;

type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- PromptInputTabsList: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputTabsList = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputTabsListProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputTabsListProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputTabsList's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputTabProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- PromptInputTab: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputTab = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputTabProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputTabProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputTab's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputTabLabelProps = HTMLAttributes<HTMLHeadingElement>;

/* oxlint-disable react/no-multi-comp -- PromptInputTabLabel: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputTabLabel = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputTabLabelProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className and children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputTabLabelProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <h3
    className={cn(
      "text-muted-foreground mb-2 px-3 text-xs font-medium",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputTabLabel's native h3 attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children}
  </h3>
);
/* oxlint-enable react/no-multi-comp */

type PromptInputTabBodyProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- PromptInputTabBody: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputTabBody = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputTabBodyProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputTabBodyProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn("space-y-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputTabBody's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputTabItemProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- PromptInputTabItem: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputTabItem = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputTabItemProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputTabItemProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(
      "hover:bg-accent flex items-center gap-2 px-3 py-2 text-xs",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputTabItem's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputCommandProps = ComponentProps<typeof Command>;

/* oxlint-disable react/no-multi-comp -- PromptInputCommand: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputCommand = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputCommandProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputCommandProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <Command
    // oxlint-disable-next-line react/forbid-component-props -- Command accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputCommand's Command prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>;

/* oxlint-disable react/no-multi-comp -- PromptInputCommandInput: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputCommandInput = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputCommandInputProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputCommandInputProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <CommandInput
    // oxlint-disable-next-line react/forbid-component-props -- CommandInput accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputCommandInput's CommandInput prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputCommandListProps = ComponentProps<typeof CommandList>;

/* oxlint-disable react/no-multi-comp -- PromptInputCommandList: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputCommandList = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputCommandListProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputCommandListProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <CommandList
    // oxlint-disable-next-line react/forbid-component-props -- CommandList accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputCommandList's CommandList prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>;

/* oxlint-disable react/no-multi-comp -- PromptInputCommandEmpty: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputCommandEmpty = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputCommandEmptyProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputCommandEmptyProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <CommandEmpty
    // oxlint-disable-next-line react/forbid-component-props -- CommandEmpty accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputCommandEmpty's CommandEmpty prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>;

/* oxlint-disable react/no-multi-comp -- PromptInputCommandGroup: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputCommandGroup = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputCommandGroupProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputCommandGroupProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <CommandGroup
    // oxlint-disable-next-line react/forbid-component-props -- CommandGroup accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputCommandGroup's CommandGroup prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>;

/* oxlint-disable react/no-multi-comp -- PromptInputCommandItem: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputCommandItem = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputCommandItemProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputCommandItemProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <CommandItem
    // oxlint-disable-next-line react/forbid-component-props -- CommandItem accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputCommandItem's CommandItem prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-enable react/no-multi-comp */

type PromptInputCommandSeparatorProps = ComponentProps<typeof CommandSeparator>;

/* oxlint-disable react/no-multi-comp -- PromptInputCommandSeparator: react/no-multi-comp: these native composition primitives form one exported PromptInput family; per-component files would add forwarding-only module boundaries without separating state or policy */

const PromptInputCommandSeparator = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- PromptInputCommandSeparatorProps: forward the complete native React/primitive prop contract, including children, refs and callback identities. The faithful readonly data projection preserving primitive, callable and constructor signatures is still flagged by the pinned rule; changing those native signatures would alter the forwarding contract. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: PromptInputCommandSeparatorProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <CommandSeparator
    // oxlint-disable-next-line react/forbid-component-props -- CommandSeparator accepts className in its styling contract; preserve this caller's layout and appearance.
    className={cn(className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward PromptInputCommandSeparator's CommandSeparator prop contract, preserving caller options, children and callbacks.
    {...props}
  />
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (PromptInput, PromptInputActionMenu, PromptInputActionMenuContent, PromptInputActionMenuItem, PromptInputActionMenuTrigger, PromptInputButton, PromptInputCommand, PromptInputCommandEmpty, PromptInputCommandGroup, PromptInputCommandInput, PromptInputCommandItem, PromptInputCommandList, PromptInputCommandSeparator, PromptInputFooter, PromptInputHeader, PromptInputHoverCard, PromptInputHoverCardContent, PromptInputHoverCardTrigger, PromptInputSelect, PromptInputSelectContent, PromptInputSelectItem, PromptInputSelectTrigger, PromptInputSelectValue, PromptInputSpeechButton, PromptInputSubmit, PromptInputTab, PromptInputTabBody, PromptInputTabItem, PromptInputTabLabel, PromptInputTabsList, PromptInputTools); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable max-lines -- The exported PromptInput family keeps native composition defaults, styling overrides and prop/ref forwarding together. Per-component files would add forwarding-only boundaries, while a barrel would preserve the same API and leave the same policy duplicated across those files. */
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
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (PromptInputActionMenuContentProps, PromptInputActionMenuItemProps, PromptInputActionMenuProps, PromptInputActionMenuTriggerProps, PromptInputButtonProps, PromptInputCommandEmptyProps, PromptInputCommandGroupProps, PromptInputCommandInputProps, PromptInputCommandItemProps, PromptInputCommandListProps, PromptInputCommandProps, PromptInputCommandSeparatorProps, PromptInputFooterProps, PromptInputHeaderProps, PromptInputHoverCardContentProps, PromptInputHoverCardProps, PromptInputHoverCardTriggerProps, PromptInputProps, PromptInputSelectContentProps, PromptInputSelectItemProps, PromptInputSelectProps, PromptInputSelectTriggerProps, PromptInputSelectValueProps, PromptInputSpeechButtonProps, PromptInputSubmitProps, PromptInputTabBodyProps, PromptInputTabItemProps, PromptInputTabLabelProps, PromptInputTabProps, PromptInputTabsListProps, PromptInputToolsProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
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
/* oxlint-enable import/no-named-export */
