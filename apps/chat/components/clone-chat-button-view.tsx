"use client";

import { Copy, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

export function CloneChatButtonView({
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
}) {
  return (
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
}
