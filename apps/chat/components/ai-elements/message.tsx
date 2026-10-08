"use client";

import "streamdown/styles.css";

import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import type {
  ComponentProps,
  HTMLAttributes,
  ReactElement,
  JSX as ReactJSX,
} from "react";
import type { FileUIPart, UIMessage } from "ai";
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import Image from "next/image";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
/* oxlint-disable import/max-dependencies -- This shared message module forwards 13 distinct native image, streaming, styling and caller contracts; retain its existing public compound component surface. */
import { code } from "@streamdown/code";
/* oxlint-enable import/max-dependencies */
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";

const selectLabel = <Fallback extends string | undefined>(
  label: string | undefined,
  fallback: Fallback
): string | Fallback => {
  if (typeof label === "string" && label !== "") {
    return label;
  }
  return fallback;
};

const plugins = { code, math, mermaid };

type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

const Message = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    from,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, from from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(
      "group flex w-full max-w-[80%] gap-2",
      // oxlint-disable-next-line no-ternary -- Keep cn argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Message's native div attributes, preserving caller events and accessibility props.
    {...props}
  />
);

type MessageContentProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp -- MessageContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const MessageContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageContentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(
      "is-user:dark flex w-fit flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:px-4 group-[.is-user]:py-3",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageContent's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children}
  </div>
);
/* oxlint-enable react/no-multi-comp */

type MessageActionsProps = ComponentProps<"div">;

/* oxlint-disable react/no-multi-comp -- MessageActions: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const MessageActions = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageActionsProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn("flex items-center gap-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageActions's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children}
  </div>
);
/* oxlint-enable react/no-multi-comp */

type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp -- MessageAction: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including label). */

const MessageAction = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    tooltip,
    children,
    label,
    variant = "ghost",
    size = "icon-sm",
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes tooltip, children, label, variant, size from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageActionProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const button = (
    <Button
      size={size}
      type="button"
      variant={variant}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageAction's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children}
      <span className="sr-only">{selectLabel(label, tooltip)}</span>
    </Button>
  );

  if (typeof tooltip === "string" && tooltip !== "") {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>
            <p>{tooltip}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
};
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp */

interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: readonly ReadonlyNativeSurface<ReactElement>[];
  setBranches: (
    branches: readonly ReadonlyNativeSurface<ReactElement>[]
  ) => void;
}

/* oxlint-disable unicorn/no-null -- MessageBranchContext: unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const MessageBranchContext = createContext<MessageBranchContextType | null>(
  null
);
/* oxlint-enable unicorn/no-null */

const useMessageBranch = (): MessageBranchContextType => {
  const context = useContext(MessageBranchContext);

  if (!context) {
    throw new Error(
      "MessageBranch components must be used within MessageBranch"
    );
  }

  return context;
};

type MessageBranchProps = HTMLAttributes<HTMLDivElement> & {
  defaultBranch?: number;
  onBranchChange?: (branchIndex: number) => void;
};

const FIRST_BRANCH_INDEX = 0;
const BRANCH_STEP = 1;
const SINGLE_BRANCH_COUNT = 1;
const BRANCH_ICON_SIZE = 14;

const useMessageBranchState = (
  defaultBranch: number,
  onBranchChange: MessageBranchProps["onBranchChange"]
): MessageBranchContextType => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<
    readonly ReadonlyNativeSurface<ReactElement>[]
  >([]);

  const handleBranchChange = useCallback(
    (newBranch: number) => {
      setCurrentBranch(newBranch);
      if (typeof onBranchChange === "function") {
        onBranchChange(newBranch);
      }
    },
    [onBranchChange]
  );

  const goToPrevious = useCallback(() => {
    const newBranch =
      // oxlint-disable-next-line no-ternary -- Keep newBranch as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      currentBranch > FIRST_BRANCH_INDEX
        ? currentBranch - BRANCH_STEP
        : branches.length - BRANCH_STEP;
    handleBranchChange(newBranch);
  }, [branches.length, currentBranch, handleBranchChange]);

  const goToNext = useCallback(() => {
    const newBranch =
      // oxlint-disable-next-line no-ternary -- Keep newBranch as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      currentBranch < branches.length - BRANCH_STEP
        ? currentBranch + BRANCH_STEP
        : FIRST_BRANCH_INDEX;
    handleBranchChange(newBranch);
  }, [branches.length, currentBranch, handleBranchChange]);

  const contextValue = useMemo<MessageBranchContextType>(
    () => ({
      branches,
      currentBranch,
      goToNext,
      goToPrevious,
      setBranches,
      totalBranches: branches.length,
    }),
    [branches, currentBranch, goToNext, goToPrevious]
  );

  return contextValue;
};

/* oxlint-disable react/no-multi-comp -- MessageBranch: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const MessageBranch = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    defaultBranch = FIRST_BRANCH_INDEX,
    onBranchChange,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes defaultBranch, onBranchChange, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageBranchProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const contextValue = useMessageBranchState(defaultBranch, onBranchChange);

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div
        className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
        // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageBranch's native div attributes, preserving caller events and accessibility props.
        {...props}
      />
    </MessageBranchContext.Provider>
  );
};
/* oxlint-enable react/no-multi-comp */

type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

const MessageBranchContent = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageBranchContentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element[] => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(() => {
    if (Array.isArray(children)) {
      // oxlint-disable-next-line typescript/no-unsafe-return -- #598: Branch rendering retains caller-provided element keys; Children.toArray would normalize keys and change the existing branch identity contract.
      return children;
    }
    return [children];
  }, [children]);

  // Use useEffect to update branches when they change
  useEffect(() => {
    if (branches.length !== childrenArray.length) {
      setBranches(childrenArray);
    }
  }, [childrenArray, branches, setBranches]);

  return childrenArray.map((branch, index): React.JSX.Element => (
    <div
      className={cn(
        "grid gap-2 overflow-hidden [&>div]:pb-0",
        // oxlint-disable-next-line no-ternary -- Keep cn argument as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        index === currentBranch ? "block" : "hidden"
      )}

      // oxlint-disable-next-line typescript/no-unsafe-assignment, typescript/no-unsafe-member-access -- #595: Branch rendering retains caller-provided element keys; Children.toArray would normalize keys and change the existing branch identity contract. #597: Branch rendering retains caller-provided element keys; Children.toArray would normalize keys and change the existing branch identity contract.
      key={branch.key}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageBranchContent's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      {branch}
    </div>
  ));
};

type MessageBranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

/* oxlint-disable react/no-multi-comp, unicorn/no-null -- MessageBranchSelector: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const MessageBranchSelector = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className: _className,
    from: _from,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, from from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageBranchSelectorProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element | null => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= SINGLE_BRANCH_COUNT) {
    return null;
  }

  return (
    <ButtonGroup
      // oxlint-disable-next-line react/forbid-component-props -- ButtonGroup accepts className in its styling contract; preserve this caller's layout and appearance.
      className="[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md"
      orientation="horizontal"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageBranchSelector's ButtonGroup prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  );
};
/* oxlint-enable react/no-multi-comp, unicorn/no-null */

type MessageBranchPreviousProps = ComponentProps<typeof Button>;

/* oxlint-disable react/no-multi-comp -- MessageBranchPrevious: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const MessageBranchPrevious = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageBranchPreviousProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= SINGLE_BRANCH_COUNT}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageBranchPrevious's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children ?? <ChevronLeftIcon size={BRANCH_ICON_SIZE} />}
    </Button>
  );
};
/* oxlint-enable react/no-multi-comp */

type MessageBranchNextProps = ComponentProps<typeof Button>;

/* oxlint-disable react/no-multi-comp -- MessageBranchNext: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const MessageBranchNext = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    className: _className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageBranchNextProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= SINGLE_BRANCH_COUNT}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageBranchNext's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children ?? <ChevronRightIcon size={BRANCH_ICON_SIZE} />}
    </Button>
  );
};
/* oxlint-enable react/no-multi-comp */

type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;
/* oxlint-disable react/jsx-no-literals -- MessageBranchPage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable react/no-multi-comp -- MessageBranchPage: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const MessageBranchPage = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageBranchPageProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      // oxlint-disable-next-line react/forbid-component-props -- ButtonGroupText accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "text-muted-foreground border-none bg-transparent shadow-none",
        className
      )}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageBranchPage's ButtonGroupText prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {currentBranch + BRANCH_STEP} of {totalBranches}
    </ButtonGroupText>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/no-multi-comp */

type MessageResponseProps = ComponentProps<typeof Streamdown>;

/* oxlint-disable react/no-multi-comp -- MessageResponse: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const MessageResponse = memo(
  (
    /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    { className, ...props }: MessageResponseProps
    /* oxlint-enable typescript/prefer-readonly-parameter-types */
  ): React.JSX.Element => (
    <Streamdown
      // oxlint-disable-next-line react/forbid-component-props -- Streamdown accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={plugins}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageResponse's Streamdown prop contract, preserving caller options, children and callbacks.
      {...props}
    />
  ),
  (
    prevProps: { readonly children?: string | undefined },
    nextProps: { readonly children?: string | undefined }
  ) => prevProps.children === nextProps.children
);
/* oxlint-enable react/no-multi-comp */

MessageResponse.displayName = "MessageResponse";

type MessageAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: FileUIPart;
  className?: string;
  onRemove?: () => void;
};
/* oxlint-disable react/jsx-no-literals -- MessageAttachment renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable max-lines-per-function, react/jsx-max-depth, react/no-multi-comp -- MessageAttachment: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including data.filename). */

const MessageAttachment = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    data,
    className,
    onRemove,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes data, className, onRemove from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageAttachmentProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
  const filename = selectLabel(data.filename, "");
  const { mediaType } = data;
  const isImage =
    typeof mediaType === "string" &&
    mediaType.startsWith("image/") &&
    Boolean(data.url);
  const attachmentLabel = selectLabel(
    filename,
    // oxlint-disable-next-line no-ternary -- Both image and generic attachment labels are authored fallback copy for the public FileUIPart view.
    isImage ? "Image" : "Attachment"
  );
  const handleRemove = useCallback(
    (event: { readonly stopPropagation: () => void }): void => {
      event.stopPropagation();
      if (typeof onRemove === "function") {
        onRemove();
      }
    },
    [onRemove]
  );

  return (
    <div
      className={cn(
        "group relative size-24 overflow-hidden rounded-lg",
        className
      )}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageAttachment's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        isImage ? (
          <>
            <Image
              alt={selectLabel(filename, "attachment")}
              loading="eager"
              unoptimized
              // oxlint-disable-next-line react/forbid-component-props -- Next Image forwards className to its native image; preserve the existing sizing and object-fit contract.
              className="size-full object-cover"
              height={100}
              src={data.url}
              width={100}
            />
            {typeof onRemove === "function" && (
              <Button
                aria-label="Remove attachment"
                // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                className="bg-background/80 hover:bg-background absolute top-2 right-2 size-6 rounded-full p-0 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 [&>svg]:size-3"
                onClick={handleRemove}
                type="button"
                variant="ghost"
              >
                <XIcon />
                <span className="sr-only">Remove</span>
              </Button>
            )}
          </>
        ) : (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="bg-muted text-muted-foreground flex size-full shrink-0 items-center justify-center rounded-lg">
                  <PaperclipIcon
                    // oxlint-disable-next-line react/forbid-component-props -- PaperclipIcon accepts className in its styling contract; preserve this caller's layout and appearance.
                    className="size-4"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>{attachmentLabel}</p>
              </TooltipContent>
            </Tooltip>
            {typeof onRemove === "function" && (
              <Button
                aria-label="Remove attachment"
                // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                className="hover:bg-accent size-6 shrink-0 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100 [&>svg]:size-3"
                onClick={handleRemove}
                type="button"
                variant="ghost"
              >
                <XIcon />
                <span className="sr-only">Remove</span>
              </Button>
            )}
          </>
        )
      }
    </div>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable max-lines-per-function, react/jsx-max-depth, react/no-multi-comp */

type MessageAttachmentsProps = ComponentProps<"div">;

/* oxlint-disable react/no-multi-comp, typescript/strict-boolean-expressions, unicorn/no-null -- MessageAttachments: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const MessageAttachments = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    className,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageAttachmentsProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element | null => {
  if (!children) {
    return null;
  }

  return (
    <div
      className={cn(
        "ml-auto flex w-fit flex-wrap items-start gap-2",
        className
      )}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageAttachments's native div attributes, preserving caller events and accessibility props.
      {...props}
    >
      {children}
    </div>
  );
};
/* oxlint-enable react/no-multi-comp, typescript/strict-boolean-expressions, unicorn/no-null */

type MessageToolbarProps = ComponentProps<"div">;

/* oxlint-disable react/no-multi-comp -- MessageToolbar: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract */

const MessageToolbar = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: MessageToolbarProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <div
    className={cn(
      "mt-4 flex w-full items-center justify-between gap-4",
      className
    )}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageToolbar's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children}
  </div>
);
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (Message, MessageAction, MessageActions, MessageAttachment, MessageAttachments, MessageBranch, MessageBranchContent, MessageBranchNext, MessageBranchPage, MessageBranchPrevious, MessageBranchSelector, MessageContent, MessageResponse, MessageToolbar); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/no-multi-comp */

/* oxlint-disable max-lines -- message keeps its cohesive feature and related render helpers together; splitting this module requires a separate public-boundary review. This exception covers the file-length metric. */
export {
  Message,
  MessageAction,
  MessageActions,
  MessageAttachment,
  MessageAttachments,
  MessageBranch,
  MessageBranchContent,
  MessageBranchNext,
  MessageBranchPage,
  MessageBranchPrevious,
  MessageBranchSelector,
  MessageContent,
  MessageResponse,
  MessageToolbar,
};
/* oxlint-enable import/no-named-export */
/* oxlint-disable import/no-named-export -- Keep the named type bindings (MessageActionProps, MessageActionsProps, MessageAttachmentProps, MessageAttachmentsProps, MessageBranchContentProps, MessageBranchNextProps, MessageBranchPageProps, MessageBranchPreviousProps, MessageBranchProps, MessageBranchSelectorProps, MessageContentProps, MessageProps, MessageResponseProps, MessageToolbarProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type {
  MessageActionProps,
  MessageActionsProps,
  MessageAttachmentProps,
  MessageAttachmentsProps,
  MessageBranchContentProps,
  MessageBranchNextProps,
  MessageBranchPageProps,
  MessageBranchPreviousProps,
  MessageBranchProps,
  MessageBranchSelectorProps,
  MessageContentProps,
  MessageProps,
  MessageResponseProps,
  MessageToolbarProps,
};
/* oxlint-enable import/no-named-export */
