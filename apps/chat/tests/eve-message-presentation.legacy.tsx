/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../components/ai-elements/message"; "../hooks/use-mobile"; "../lib/utils" dependency within this package instead of introducing an alias or barrel API.
 */
import { Copy, Pencil, PencilOff } from "lucide-react";
import React, { useState } from "react";
import type { ReactNode } from "react";

import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
} from "../components/ai-elements/message";
import { useIsMobile } from "../hooks/use-mobile";
import { cn } from "../lib/utils";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, react/forbid-component-props, typescript/prefer-readonly-parameter-types --
 * import/group-exports (#523): LegacyMessageActionsReference stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): LegacyMessageActionsReference's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): LegacyMessageActionsReference's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): LegacyMessageActionsReference keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * react/forbid-component-props (#545): LegacyMessageActionsReference uses className/style as established component styling interfaces; removing them changes the rendered contract.
 * typescript/prefer-readonly-parameter-types (#565): LegacyMessageActionsReference accepts { isEditing, isLoading, isReadonly, onCancelEdit, onStartEdit, siblings, }: { isEditi; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 */
/**
 * Frozen presentation reference from main commit
 * 4584f093835f1667c010c8fc20c502fa3f2bde41.
 *
 * The original UserMessage reads its message and controls from the legacy
 * store. This adapter keeps the original JSX/classes and replaces those
 * stores with fixture props so the parity test stays offline and deterministic.
 */
export const LegacyMessageActionsReference = ({
  isEditing,
  isLoading,
  isReadonly,
  onCancelEdit,
  onStartEdit,
  siblings,
}: {
  isEditing: boolean;
  isLoading: boolean;
  isReadonly: boolean;
  onCancelEdit?: () => void;
  onStartEdit?: () => void;
  siblings?: ReactNode;
}): React.JSX.Element => {
  const isMobile = useIsMobile();
  if (isLoading) {
    return <div className="h-7" />;
  }
  const showActionsWithoutHover = isMobile || isEditing;
  return (
    <MessageActions
      className={
        showActionsWithoutHover
          ? ""
          : "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-hover/message:opacity-100 focus-within:opacity-100 hover:opacity-100"
      }
    >
      {!isReadonly &&
        (isEditing ? (
          <MessageAction
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
            onClick={onCancelEdit}
            tooltip="Cancel edit"
          >
            <PencilOff className="h-3.5 w-3.5" />
          </MessageAction>
        ) : (
          <MessageAction
            className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
            onClick={onStartEdit}
            tooltip="Edit message"
          >
            <Pencil className="h-3.5 w-3.5" />
          </MessageAction>
        ))}
      {siblings}
      <MessageAction
        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground h-7 w-7 p-0"
        tooltip="Copy"
      >
        <Copy size={14} />
      </MessageAction>
    </MessageActions>
  );
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, react/forbid-component-props, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions --
 * import/group-exports (#523): LegacyUserMessageReference stays exported at its declaration so its public contract is visible beside its implementation.
 * jsdoc/require-param (#534): LegacyUserMessageReference's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * jsdoc/require-returns (#535): LegacyUserMessageReference's existing documentation covers its purpose while TypeScript carries the shape; meaningful parameter/return guarantees require authored domain documentation, not placeholder tags.
 * max-lines-per-function (#510): LegacyUserMessageReference keeps its scenario setup, action, and assertions together; extracting smaller units requires choosing domain boundaries rather than satisfying a numeric threshold.
 * no-undefined (#519): LegacyUserMessageReference uses undefined for absent or optional values; substituting null would alter its type and serialization contract.
 * react-perf/jsx-no-new-function-as-prop (#557): LegacyUserMessageReference creates render-local values that capture current state; memoization needs dependency and consumer-identity review rather than unconditional hoisting.
 * react/forbid-component-props (#545): LegacyUserMessageReference uses className/style as established component styling interfaces; removing them changes the rendered contract.
 * react/jsx-max-depth (#548): LegacyUserMessageReference keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * react/no-multi-comp (#552): LegacyUserMessageReference keeps related fixture render states together; extraction changes component, state, and layout boundaries.
 * typescript/prefer-readonly-parameter-types (#565): LegacyUserMessageReference accepts { editor, isLoading, isReadonly, messageId, responses, siblings, text, }: { editor?:; event; deep-readonly conversion changes assignability at its fixture/mock boundary and needs an ownership-contract migration.
 * typescript/strict-boolean-expressions (#610): LegacyUserMessageReference intentionally keeps the existing falsy-value behavior of selection?.toString(); distinguishing empty, zero, and absent states requires a domain behavior decision.
 */
/** Frozen UserMessage layout with provider-backed dependencies adapted to props. */
export const LegacyUserMessageReference = ({
  editor,
  isLoading,
  isReadonly,
  messageId,
  responses,
  siblings,
  text,
}: {
  editor?: ReactNode;
  isLoading: boolean;
  isReadonly: boolean;
  messageId: string;
  responses?: ReactNode;
  siblings?: ReactNode;
  text: string;
}): React.JSX.Element => {
  const [mode, setMode] = useState<"view" | "edit">("view");
  return (
    <Message
      className={cn(
        mode === "edit" ? "max-w-full [&>div]:max-w-full" : undefined,
        "py-1"
      )}
      data-message-id={messageId}
      data-testid="legacy-user-message"
      from="user"
    >
      <div
        className={cn(
          "flex w-full flex-col gap-2",
          mode !== "edit" && "items-end"
        )}
      >
        {mode === "view" && responses}
        {mode === "view" && isReadonly && (
          <MessageContent
            className="group-[.is-user]:bg-card text-left"
            data-testid="legacy-message-content"
          >
            <pre className="font-sans whitespace-pre-wrap">{text}</pre>
          </MessageContent>
        )}
        {mode === "view" && !isReadonly && (
          <button
            aria-label={text}
            className="block cursor-pointer text-left transition-opacity select-text hover:opacity-80"
            data-testid="legacy-message-content"
            onClick={(event) => {
              const selection = globalThis.getSelection();
              if (
                selection?.toString() &&
                event.currentTarget.contains(selection.anchorNode)
              ) {
                return;
              }
              setMode("edit");
            }}
            type="button"
          >
            <MessageContent
              className="group-[.is-user]:bg-card text-left group-[.is-user]:max-w-none"
              data-testid="legacy-message-content"
            >
              <pre className="font-sans whitespace-pre-wrap">{text}</pre>
            </MessageContent>
          </button>
        )}
        {mode !== "view" && (
          <div className="flex flex-row items-start gap-2">{editor}</div>
        )}
        <div className="self-end">
          <LegacyMessageActionsReference
            isEditing={mode === "edit"}
            isLoading={isLoading}
            isReadonly={isReadonly}
            onCancelEdit={() => setMode("view")}
            onStartEdit={() => setMode("edit")}
            siblings={siblings}
          />
        </div>
      </div>
    </Message>
  );
};
/* oxlint-enable import/group-exports, jsdoc/require-param, jsdoc/require-returns, max-lines-per-function, no-undefined, react-perf/jsx-no-new-function-as-prop, react/forbid-component-props, react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types, typescript/strict-boolean-expressions */
