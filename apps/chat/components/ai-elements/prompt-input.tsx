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
  useMemo,
  useState,
  useSyncExternalStore,
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
  ...props
}: PromptInputHoverCardProps): React.JSX.Element => (
  <HoverCard closeDelay={closeDelay} openDelay={openDelay} {...props} />
);

const PromptInputHoverCardContent = ({
  align = "start",
  ...props
}: PromptInputHoverCardContentProps): React.JSX.Element => (
  <HoverCardContent align={align} {...props} />
);

/** Presentation only: draft submission and file state belong to the composer. */
type PromptInputProps = HTMLAttributes<HTMLFormElement> & {
  inputGroupClassName?: string;
};

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

type PromptInputHeaderProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

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

type PromptInputFooterProps = Omit<
  ComponentProps<typeof InputGroupAddon>,
  "align"
>;

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

type PromptInputToolsProps = HTMLAttributes<HTMLDivElement>;

const PromptInputTools = ({
  className,
  ...props
}: PromptInputToolsProps): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)} {...props} />
);

type PromptInputButtonProps = ComponentProps<typeof InputGroupButton>;

const PromptInputButton = ({
  variant = "ghost",
  className,
  size,
  ...props
}: PromptInputButtonProps): React.JSX.Element => {
  const newSize =
    size ??
    // oxlint-disable-next-line react/no-react-children -- Native boundary tests cover null slots, nested arrays and opaque fragments; normalizing children would change this public sizing contract.
    (Children.count(props.children) > SINGLE_BUTTON_CHILD ? "sm" : "icon-sm");

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

type PromptInputActionMenuProps = ComponentProps<typeof DropdownMenu>;

const PromptInputActionMenu = (
  props: PromptInputActionMenuProps
): React.JSX.Element => <DropdownMenu {...props} />;

type PromptInputActionMenuTriggerProps = PromptInputButtonProps;

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

type PromptInputActionMenuContentProps = ComponentProps<
  typeof DropdownMenuContent
>;

const PromptInputActionMenuContent = ({
  className,
  ...props
}: PromptInputActionMenuContentProps): React.JSX.Element => (
  <DropdownMenuContent align="start" className={cn(className)} {...props} />
);

type PromptInputActionMenuItemProps = ComponentProps<typeof DropdownMenuItem>;

const PromptInputActionMenuItem = ({
  className,
  ...props
}: PromptInputActionMenuItemProps): React.JSX.Element => (
  <DropdownMenuItem className={cn(className)} {...props} />
);

// Note: Actions that perform side-effects (like opening a file dialog)
// are provided in opt-in modules (e.g., prompt-input-attachments).

type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
};

const PromptInputSubmit = ({
  className,
  variant = "default",
  size = "icon-sm",
  status,
  children,
  ...props
}: PromptInputSubmitProps): React.JSX.Element => {
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
    console.error("Speech recognition error:", event);
    setIsListening(false);
  });
  return speechRecognition;
};

const createSpeechRecognitionStore = (
  onResult: NonNullable<SpeechRecognition["onresult"]>,
  setIsListening: (listening: boolean) => void
) => {
  let recognition: SpeechRecognition | null = null;
  return {
    getSnapshot: () => recognition,
    getServerSnapshot: () => null,
    subscribe: (notify: () => void) => {
      if (
        "window" in globalThis &&
        ("SpeechRecognition" in globalThis.window ||
          "webkitSpeechRecognition" in globalThis.window)
      ) {
        const Constructor =
          globalThis.window.SpeechRecognition ??
          globalThis.window.webkitSpeechRecognition;
        recognition = initializeSpeechRecognition(
          Constructor,
          onResult,
          setIsListening
        );
        notify();
      }
      return () => {
        recognition?.stop();
        recognition = null;
      };
    },
  };
};

const useSpeechRecognition = (
  onResult: NonNullable<SpeechRecognition["onresult"]>
): Readonly<{
  isListening: boolean;
  recognition: SpeechRecognition | null;
  toggleListening: () => void;
}> => {
  const [isListening, setIsListening] = useState(false);
  const store = useMemo(
    () => createSpeechRecognitionStore(onResult, setIsListening),
    [onResult]
  );
  const recognition = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    store.getServerSnapshot
  );

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

const PromptInputSpeechButton = ({
  className,
  textareaRef,
  onTranscriptionChange,
  ...props
}: PromptInputSpeechButtonProps): ReactJSX.Element => {
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

type PromptInputSelectProps = ComponentProps<typeof Select>;

const PromptInputSelect = (
  props: ReadonlyNativeSurface<PromptInputSelectProps>
): React.JSX.Element => <Select {...props} />;

type PromptInputSelectTriggerProps = ComponentProps<typeof SelectTrigger>;

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

type PromptInputSelectContentProps = ComponentProps<typeof SelectContent>;

const PromptInputSelectContent = ({
  className,
  ...props
}: PromptInputSelectContentProps): React.JSX.Element => (
  <SelectContent className={cn(className)} {...props} />
);

type PromptInputSelectItemProps = ComponentProps<typeof SelectItem>;

const PromptInputSelectItem = ({
  className,
  ...props
}: PromptInputSelectItemProps): React.JSX.Element => (
  <SelectItem className={cn(className)} {...props} />
);

type PromptInputSelectValueProps = ComponentProps<typeof SelectValue>;

const PromptInputSelectValue = ({
  className,
  ...props
}: PromptInputSelectValueProps): React.JSX.Element => (
  <SelectValue className={cn(className)} {...props} />
);

type PromptInputHoverCardProps = ComponentProps<typeof HoverCard>;

type PromptInputHoverCardTriggerProps = ComponentProps<typeof HoverCardTrigger>;

const PromptInputHoverCardTrigger = (
  props: PromptInputHoverCardTriggerProps
): React.JSX.Element => <HoverCardTrigger {...props} />;

type PromptInputHoverCardContentProps = ComponentProps<typeof HoverCardContent>;

type PromptInputTabsListProps = HTMLAttributes<HTMLDivElement>;

const PromptInputTabsList = ({
  className,
  ...props
}: PromptInputTabsListProps): React.JSX.Element => (
  <div className={cn(className)} {...props} />
);

type PromptInputTabProps = HTMLAttributes<HTMLDivElement>;

const PromptInputTab = ({
  className,
  ...props
}: PromptInputTabProps): React.JSX.Element => (
  <div className={cn(className)} {...props} />
);

type PromptInputTabLabelProps = HTMLAttributes<HTMLHeadingElement>;

const PromptInputTabLabel = ({
  className,
  children,
  ...props
}: PromptInputTabLabelProps): React.JSX.Element => (
  <h3
    className={cn(
      "text-muted-foreground mb-2 px-3 text-xs font-medium",
      className
    )}
    {...props}
  >
    {children}
  </h3>
);

type PromptInputTabBodyProps = HTMLAttributes<HTMLDivElement>;

const PromptInputTabBody = ({
  className,
  ...props
}: PromptInputTabBodyProps): React.JSX.Element => (
  <div className={cn("space-y-1", className)} {...props} />
);

type PromptInputTabItemProps = HTMLAttributes<HTMLDivElement>;

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

type PromptInputCommandProps = ComponentProps<typeof Command>;

const PromptInputCommand = ({
  className,
  ...props
}: PromptInputCommandProps): React.JSX.Element => (
  <Command className={cn(className)} {...props} />
);

type PromptInputCommandInputProps = ComponentProps<typeof CommandInput>;

const PromptInputCommandInput = ({
  className,
  ...props
}: PromptInputCommandInputProps): React.JSX.Element => (
  <CommandInput className={cn(className)} {...props} />
);

type PromptInputCommandListProps = ComponentProps<typeof CommandList>;

const PromptInputCommandList = ({
  className,
  ...props
}: PromptInputCommandListProps): React.JSX.Element => (
  <CommandList className={cn(className)} {...props} />
);

type PromptInputCommandEmptyProps = ComponentProps<typeof CommandEmpty>;

const PromptInputCommandEmpty = ({
  className,
  ...props
}: PromptInputCommandEmptyProps): React.JSX.Element => (
  <CommandEmpty className={cn(className)} {...props} />
);

type PromptInputCommandGroupProps = ComponentProps<typeof CommandGroup>;

const PromptInputCommandGroup = ({
  className,
  ...props
}: PromptInputCommandGroupProps): React.JSX.Element => (
  <CommandGroup className={cn(className)} {...props} />
);

type PromptInputCommandItemProps = ComponentProps<typeof CommandItem>;

const PromptInputCommandItem = ({
  className,
  ...props
}: PromptInputCommandItemProps): React.JSX.Element => (
  <CommandItem className={cn(className)} {...props} />
);

type PromptInputCommandSeparatorProps = ComponentProps<typeof CommandSeparator>;

const PromptInputCommandSeparator = ({
  className,
  ...props
}: PromptInputCommandSeparatorProps): React.JSX.Element => (
  <CommandSeparator className={cn(className)} {...props} />
);

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
