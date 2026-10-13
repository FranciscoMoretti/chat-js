"use client";

import { hasCustomContent } from "@/components/custom-content";

import "streamdown/styles.css";

import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
import type { ComponentProps, HTMLAttributes, JSX as ReactJSX } from "react";
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
import { Streamdown } from "streamdown";
import { cn } from "@/lib/utils";
import { code } from "@streamdown/code";
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

const Message = ({
  className,
  from,
  ...props
}: MessageProps): React.JSX.Element => (
  <div
    className={cn(
      "group flex w-full max-w-[80%] gap-2",
      from === "user" ? "is-user ml-auto justify-end" : "is-assistant",
      className
    )}
    {...props}
  />
);

type MessageContentProps = HTMLAttributes<HTMLDivElement>;

const MessageContent = ({
  children,
  className,
  ...props
}: MessageContentProps): React.JSX.Element => (
  <div
    className={cn(
      "is-user:dark flex w-fit flex-col gap-2 overflow-hidden text-sm",
      "group-[.is-user]:bg-secondary group-[.is-user]:text-foreground group-[.is-user]:ml-auto group-[.is-user]:rounded-lg group-[.is-user]:px-4 group-[.is-user]:py-3",
      "group-[.is-assistant]:text-foreground",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

type MessageActionsProps = ComponentProps<"div">;

const MessageActions = ({
  className,
  children,
  ...props
}: MessageActionsProps): React.JSX.Element => (
  <div className={cn("flex items-center gap-1", className)} {...props}>
    {children}
  </div>
);

type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  ...props
}: MessageActionProps): React.JSX.Element => {
  const button = (
    <Button size={size} type="button" variant={variant} {...props}>
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

interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: readonly React.ReactNode[];
  setBranches: (branches: readonly React.ReactNode[]) => void;
}

const MessageBranchContext = createContext<MessageBranchContextType | null>(
  null
);

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
  const [branches, setBranches] = useState<readonly React.ReactNode[]>([]);

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
      currentBranch > FIRST_BRANCH_INDEX
        ? currentBranch - BRANCH_STEP
        : branches.length - BRANCH_STEP;
    handleBranchChange(newBranch);
  }, [branches.length, currentBranch, handleBranchChange]);

  const goToNext = useCallback(() => {
    const newBranch =
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

const MessageBranch = ({
  defaultBranch = FIRST_BRANCH_INDEX,
  onBranchChange,
  className,
  ...props
}: MessageBranchProps): ReactJSX.Element => {
  const contextValue = useMessageBranchState(defaultBranch, onBranchChange);

  return (
    <MessageBranchContext.Provider value={contextValue}>
      <div
        className={cn("grid w-full gap-2 [&>div]:pb-0", className)}
        {...props}
      />
    </MessageBranchContext.Provider>
  );
};

type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

const isNodeArray = (value: React.ReactNode): value is React.ReactNode[] =>
  Array.isArray(value);

const MessageBranchContent = ({
  children,
  ...props
}: MessageBranchContentProps): React.JSX.Element[] => {
  const { currentBranch, setBranches, branches } = useMessageBranch();
  const childrenArray = useMemo(() => {
    if (isNodeArray(children)) {
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
        index === currentBranch ? "block" : "hidden"
      )}

      key={React.isValidElement(branch) ? branch.key : undefined}
      {...props}
    >
      {branch}
    </div>
  ));
};

type MessageBranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

const MessageBranchSelector = ({
  className: _className,
  from: _from,
  ...props
}: MessageBranchSelectorProps): React.JSX.Element | null => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= SINGLE_BRANCH_COUNT) {
    return null;
  }

  return (
    <ButtonGroup
      className="[&>*:not(:first-child)]:rounded-l-md [&>*:not(:last-child)]:rounded-r-md"
      orientation="horizontal"
      {...props}
    />
  );
};

type MessageBranchPreviousProps = ComponentProps<typeof Button>;

const MessageBranchPrevious = ({
  children,
  ...props
}: MessageBranchPreviousProps): React.JSX.Element => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= SINGLE_BRANCH_COUNT}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronLeftIcon size={BRANCH_ICON_SIZE} />}
    </Button>
  );
};

type MessageBranchNextProps = ComponentProps<typeof Button>;

const MessageBranchNext = ({
  children,
  className: _className,
  ...props
}: MessageBranchNextProps): React.JSX.Element => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= SINGLE_BRANCH_COUNT}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      {...props}
    >
      {children ?? <ChevronRightIcon size={BRANCH_ICON_SIZE} />}
    </Button>
  );
};

type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;

const MessageBranchPage = ({
  className,
  ...props
}: MessageBranchPageProps): React.JSX.Element => {
  const { currentBranch, totalBranches } = useMessageBranch();

  return (
    <ButtonGroupText
      className={cn(
        "text-muted-foreground border-none bg-transparent shadow-none",
        className
      )}
      {...props}
    >
      {currentBranch + BRANCH_STEP} of {totalBranches}
    </ButtonGroupText>
  );
};

type MessageResponseProps = ComponentProps<typeof Streamdown>;

const MessageResponseComponent = ({
  className,
  ...props
}: MessageResponseProps): React.JSX.Element => (
  <Streamdown
    className={cn(
      "size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
      className
    )}
    plugins={plugins}
    {...props}
  />
);

const MessageResponse = memo(
  MessageResponseComponent,
  (
    prevProps: { readonly children?: string | undefined },
    nextProps: { readonly children?: string | undefined }
  ) => prevProps.children === nextProps.children
);

MessageResponse.displayName = "MessageResponse";

type MessageAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: FileUIPart;
  className?: string;
  onRemove?: () => void;
};

const MessageAttachment = ({
  data,
  className,
  onRemove,
  ...props
}: MessageAttachmentProps): ReactJSX.Element => {
  const filename = selectLabel(data.filename, "");
  const { mediaType } = data;
  const isImage =
    typeof mediaType === "string" &&
    mediaType.startsWith("image/") &&
    Boolean(data.url);
  const attachmentLabel = selectLabel(
    filename,
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
      {...props}
    >
      {isImage ? (
        <>
          <Image
            alt={selectLabel(filename, "attachment")}
            loading="eager"
            unoptimized
            className="size-full object-cover"
            height={100}
            src={data.url}
            width={100}
          />
          {typeof onRemove === "function" && (
            <Button
              aria-label="Remove attachment"
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
                <PaperclipIcon className="size-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{attachmentLabel}</p>
            </TooltipContent>
          </Tooltip>
          {typeof onRemove === "function" && (
            <Button
              aria-label="Remove attachment"
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
      )}
    </div>
  );
};

type MessageAttachmentsProps = ComponentProps<"div">;

const MessageAttachments = ({
  children,
  className,
  ...props
}: MessageAttachmentsProps): React.JSX.Element | null => {
  if (!hasCustomContent(children)) {
    return null;
  }

  return (
    <div
      className={cn(
        "ml-auto flex w-fit flex-wrap items-start gap-2",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

type MessageToolbarProps = ComponentProps<"div">;

const MessageToolbar = ({
  className,
  children,
  ...props
}: MessageToolbarProps): React.JSX.Element => (
  <div
    className={cn(
      "mt-4 flex w-full items-center justify-between gap-4",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

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
