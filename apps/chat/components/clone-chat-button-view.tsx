"use client";

import { Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import React from "react";

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
