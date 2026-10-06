"use client";

import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import { mermaid } from "@streamdown/mermaid";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { FileUIPart, UIMessage } from "ai";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PaperclipIcon,
  XIcon,
} from "lucide-react";
/* oxlint-enable sort-imports */
import type {
  ComponentProps,
  HTMLAttributes,
  ReactElement,
  JSX as ReactJSX,
} from "react";
import React, {
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Streamdown } from "streamdown";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import { ButtonGroup, ButtonGroupText } from "@/components/ui/button-group";
/* oxlint-enable sort-imports */
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
/* oxlint-disable import/max-dependencies -- @/lib/utils import: import/max-dependencies: these direct dependencies compose this feature without hiding imports behind a barrel. */
import { cn } from "@/lib/utils";
/* oxlint-enable import/max-dependencies */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import "streamdown/styles.css";
/* oxlint-enable sort-imports */

const plugins = { code, math, mermaid };

type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Message: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, from, ...props }: MessageProps). */

const Message = ({
  className,
  from,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, from from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageProps): React.JSX.Element => (
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */

type MessageContentProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- MessageContent: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, className, ...props }: MessageContentProps). */

const MessageContent = ({
  children,
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageContentProps): React.JSX.Element => (
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type MessageActionsProps = ComponentProps<"div">;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- MessageActions: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: MessageActionsProps). */

const MessageActions = ({
  className,
  children,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageActionsProps): React.JSX.Element => (
  <div
    className={cn("flex items-center gap-1", className)}
    // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageActions's native div attributes, preserving caller events and accessibility props.
    {...props}
  >
    {children}
  </div>
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type MessageActionProps = ComponentProps<typeof Button> & {
  tooltip?: string;
  label?: string;
};

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- MessageAction: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including label). */

const MessageAction = ({
  tooltip,
  children,
  label,
  variant = "ghost",
  size = "icon-sm",
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes tooltip, children, label, variant, size from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageActionProps): React.JSX.Element => {
  const button = (
    <Button
      size={size}
      type="button"
      variant={variant}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageAction's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children}
      {/* oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value. */}
      <span className="sr-only">{label || tooltip}</span>
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
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

/* oxlint-disable typescript/prefer-readonly-parameter-types -- MessageBranchContextType: typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including branches: ReactElement[]). */

interface MessageBranchContextType {
  currentBranch: number;
  totalBranches: number;
  goToPrevious: () => void;
  goToNext: () => void;
  branches: ReactElement[];
  setBranches: (branches: ReactElement[]) => void;
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
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

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- MessageBranch: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const MessageBranch = ({
  defaultBranch = 0,
  onBranchChange,
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes defaultBranch, onBranchChange, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageBranchProps): ReactJSX.Element => {
  const [currentBranch, setCurrentBranch] = useState(defaultBranch);
  const [branches, setBranches] = useState<ReactElement[]>([]);

  const handleBranchChange = useCallback(
    (newBranch: number) => {
      setCurrentBranch(newBranch);
      // oxlint-disable-next-line oxc/no-optional-chaining -- Keep the existing nullish guard when calling onBranchChange; preserve one receiver evaluation, skipped call arguments and the undefined short-circuit result. The app guidance prefers optional chaining.
      onBranchChange?.(newBranch);
    },
    [onBranchChange]
  );

  const goToPrevious = useCallback(() => {
    const newBranch =
      // oxlint-disable-next-line no-ternary -- Keep newBranch as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      currentBranch > 0 ? currentBranch - 1 : branches.length - 1;
    handleBranchChange(newBranch);
  }, [branches.length, currentBranch, handleBranchChange]);

  const goToNext = useCallback(() => {
    const newBranch =
      // oxlint-disable-next-line no-ternary -- Keep newBranch as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
      currentBranch < branches.length - 1 ? currentBranch + 1 : 0;
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
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type MessageBranchContentProps = HTMLAttributes<HTMLDivElement>;

/* oxlint-disable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types -- MessageBranchContent: typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, ...props }: MessageBranchContentProps). */

const MessageBranchContent = ({
  children,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageBranchContentProps) => {
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
      // oxlint-disable-next-line typescript/no-unsafe-argument -- #594: Branch rendering retains caller-provided element keys; Children.toArray would normalize keys and change the existing branch identity contract.
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
/* oxlint-enable typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types */

type MessageBranchSelectorProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null -- MessageBranchSelector: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const MessageBranchSelector = ({
  className: _className,
  from: _from,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, from from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageBranchSelectorProps): React.JSX.Element | null => {
  const { totalBranches } = useMessageBranch();

  // Don't render if there's only one branch
  if (totalBranches <= 1) {
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
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types, unicorn/no-null */

type MessageBranchPreviousProps = ComponentProps<typeof Button>;

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- MessageBranchPrevious: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, ...props }: MessageBranchPreviousProps). */

const MessageBranchPrevious = ({
  children,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageBranchPreviousProps): React.JSX.Element => {
  const { goToPrevious, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Previous branch"
      disabled={totalBranches <= 1}
      onClick={goToPrevious}
      size="icon-sm"
      type="button"
      variant="ghost"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageBranchPrevious's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children ?? <ChevronLeftIcon size={14} />}
    </Button>
  );
};
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type MessageBranchNextProps = ComponentProps<typeof Button>;

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- MessageBranchNext: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

const MessageBranchNext = ({
  children,
  className: _className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageBranchNextProps): React.JSX.Element => {
  const { goToNext, totalBranches } = useMessageBranch();

  return (
    <Button
      aria-label="Next branch"
      disabled={totalBranches <= 1}
      onClick={goToNext}
      size="icon-sm"
      type="button"
      variant="ghost"
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward MessageBranchNext's Button prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      {children ?? <ChevronRightIcon size={14} />}
    </Button>
  );
};
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type MessageBranchPageProps = HTMLAttributes<HTMLSpanElement>;
/* oxlint-disable react/jsx-no-literals -- MessageBranchPage renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- MessageBranchPage: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 1); react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: MessageBranchPageProps). */

const MessageBranchPage = ({
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageBranchPageProps): React.JSX.Element => {
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
      {currentBranch + 1} of {totalBranches}
    </ButtonGroupText>
  );
};
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable no-magic-numbers, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

type MessageResponseProps = ComponentProps<typeof Streamdown>;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- MessageResponse: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, ...props }: MessageResponseProps). */

const MessageResponse = memo(
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ({ className, ...props }: MessageResponseProps): React.JSX.Element => (
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
  (prevProps, nextProps) => prevProps.children === nextProps.children
);
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

MessageResponse.displayName = "MessageResponse";

type MessageAttachmentProps = HTMLAttributes<HTMLDivElement> & {
  data: FileUIPart;
  className?: string;
  onRemove?: () => void;
};
/* oxlint-disable react/jsx-no-literals -- MessageAttachment renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions -- MessageAttachment: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including event); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including data.filename). */

const MessageAttachment = ({
  data,
  className,
  onRemove,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes data, className, onRemove from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageAttachmentProps): ReactJSX.Element => {
  // oxlint-disable-next-line typescript/prefer-nullish-coalescing -- #602: Empty text or a falsy optional value deliberately selects the fallback; nullish coalescing would preserve that empty value.
  const filename = data.filename || "";
  const mediaType =
    // oxlint-disable-next-line oxc/no-optional-chaining, no-ternary -- Keep the existing nullish guard when reading startsWith from data.mediaType; preserve one receiver evaluation, skipped accesses and the undefined short-circuit result. The app guidance prefers optional chaining.; no-ternary: Keep mediaType as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
    data.mediaType?.startsWith("image/") && data.url ? "image" : "file";
  const isImage = mediaType === "image";
  // oxlint-disable-next-line no-ternary -- Keep || operand as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
  const attachmentLabel = filename || (isImage ? "Image" : "Attachment");

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
            {/* oxlint-disable-next-line next/no-img-element -- Attachment URLs may be blob or data URLs. */}
            <img
              alt={filename || "attachment"}
              className="size-full object-cover"
              height={100}
              src={data.url}
              width={100}
            />
            {onRemove && (
              <Button
                aria-label="Remove attachment"
                // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                className="bg-background/80 hover:bg-background absolute top-2 right-2 size-6 rounded-full p-0 opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 [&>svg]:size-3"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
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
            {onRemove && (
              <Button
                aria-label="Remove attachment"
                // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
                className="hover:bg-accent size-6 shrink-0 rounded-full p-0 opacity-0 transition-opacity group-hover:opacity-100 [&>svg]:size-3"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove();
                }}
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
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */

type MessageAttachmentsProps = ComponentProps<"div">;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null -- MessageAttachments: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, className, ...props }: MessageAttachmentsProps); typescript/strict-boolean-expressions: the existing empty, missing, or optional value deliberately selects this feature fallback (including children); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

const MessageAttachments = ({
  children,
  className,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children, className from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageAttachmentsProps): React.JSX.Element | null => {
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions, unicorn/no-null */

type MessageToolbarProps = ComponentProps<"div">;

/* oxlint-disable react/no-multi-comp, typescript/prefer-readonly-parameter-types -- MessageToolbar: react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { className, children, ...props }: MessageToolbarProps). */

const MessageToolbar = ({
  className,
  children,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: MessageToolbarProps): React.JSX.Element => (
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
/* oxlint-enable react/no-multi-comp, typescript/prefer-readonly-parameter-types */

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
