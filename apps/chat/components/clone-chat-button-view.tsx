"use client";
/* oxlint-disable sort-imports -- Oxfmt owns this module's external, type-only, and alias import groups; its case-insensitive order conflicts with this declaration-order rule. */

import { Copy, Loader2 } from "lucide-react";
import React from "react";

import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable import/no-named-export, import/prefer-default-export, no-ternary, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/prefer-readonly-parameter-types -- CloneChatButtonView: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; no-ternary: derive the existing render or state alternative inline without introducing another mutable state variable; react/forbid-component-props: className and style are the existing Tailwind and primitive composition API; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/jsx-no-literals: these existing labels and accessible text are this feature content; localization is a separate content migration; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const CloneChatButtonView = ({
  isPending,
  onClick,
  className,
  label = "Save to your chats",
  disabled = false,
}: {
  isPending: boolean;
  onClick: () => void;
  className?: string;
  label?: string;
  disabled?: boolean;
}): React.JSX.Element => (
  <div className="m-auto flex w-fit items-center justify-center px-4 py-10">
    <Button
      className={className}
      disabled={isPending || disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant="default"
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Saving...
        </>
      ) : (
        <>
          <Copy className="mr-2 h-4 w-4" />
          {label}
        </>
      )}
    </Button>
  </div>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, no-ternary, react/forbid-component-props, react/jsx-max-depth, react/jsx-no-literals, typescript/prefer-readonly-parameter-types */
