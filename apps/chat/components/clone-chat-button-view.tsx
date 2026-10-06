"use client";

import { Copy, Loader2 } from "lucide-react";
import React from "react";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (CloneChatButtonView); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-no-literals -- CloneChatButtonView renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable sort-imports */
/* oxlint-disable react/jsx-max-depth -- CloneChatButtonView: ; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

export const CloneChatButtonView = ({
  isPending,
  onClick,
  className,
  label = "Save to your chats",
  disabled = false,
}: {
  readonly isPending: boolean;
  readonly onClick: () => void;
  readonly className?: string;
  readonly label?: string;
  readonly disabled?: boolean;
}): React.JSX.Element => (
  <div className="m-auto flex w-fit items-center justify-center px-4 py-10">
    <Button
      // oxlint-disable-next-line react/forbid-component-props -- Button accepts className in its styling contract; preserve this caller's layout and appearance.
      className={className}
      disabled={isPending || disabled}
      onClick={onClick}
      size="sm"
      type="button"
      variant="default"
    >
      {
        // oxlint-disable-next-line no-ternary -- Keep JSX child as a lazy value selection; if/else assignment of these branches conflicts with pinned unicorn/prefer-ternary.
        isPending ? (
          <>
            <Loader2
              // oxlint-disable-next-line react/forbid-component-props -- Loader2 accepts className in its styling contract; preserve this caller's layout and appearance.
              className="mr-2 h-4 w-4 animate-spin"
            />
            Saving...
          </>
        ) : (
          <>
            <Copy
              // oxlint-disable-next-line react/forbid-component-props -- Copy accepts className in its styling contract; preserve this caller's layout and appearance.
              className="mr-2 h-4 w-4"
            />
            {label}
          </>
        )
      }
    </Button>
  </div>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react/jsx-max-depth */
