"use client";

import { Copy, GlobeIcon, Loader2, LockIcon, Share } from "lucide-react";
import type React from "react";
import { useState } from "react";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { toast } from "sonner";
/* oxlint-enable sort-imports */

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { Button } from "@/components/ui/button";
/* oxlint-enable sort-imports */
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different binding-syntax groups. */
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
/* oxlint-enable sort-imports */
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSession } from "@/providers/session-provider";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { LoginPrompt } from "./upgrade-cta/login-prompt";
/* oxlint-enable sort-imports */

type ShareStep = "info" | "shared";
/* oxlint-disable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-void-return -- ShareDialogView: max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types; typescript/strict-void-return: this library event API ignores the return value while the existing handler owns its async pending and error lifecycle. */

/* oxlint-disable react/forbid-component-props -- Button, Loader2 accept the supplied styling props; preserve this composition's layout and appearance. */
const ShareDialogView = ({
  chatId,
  isPublic,
  isPending,
  onClose,
  setVisibility,
}: {
  readonly chatId: string;
  readonly isPublic: boolean;
  readonly isPending: boolean;
  readonly onClose: () => void;
  readonly setVisibility: (visibility: "private" | "public") => Promise<void>;
}): React.JSX.Element => {
  const [step, setStep] = useState<ShareStep>("info");
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleShare's awaited sequencing and rejected-Promise behavior. */
  const handleShare = async (): Promise<void> => {
    try {
      await setVisibility("public");
      setStep("shared");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to share chat."
      );
    }
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleUnshare's awaited sequencing and rejected-Promise behavior. */
  const handleUnshare = async (): Promise<void> => {
    try {
      await setVisibility("private");
      onClose();
      setStep("info");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to make chat private."
      );
    }
  };
  /* oxlint-enable oxc/no-async-await */
  /* oxlint-disable oxc/no-async-await -- Modern configured runtimes support native async; preserve handleCopyLink's awaited sequencing and rejected-Promise behavior. */
  const handleCopyLink = async (): Promise<void> => {
    const shareUrl = `${globalThis.location.origin}/share/${chatId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.error("Unable to copy share link.");
    }
  };
  /* oxlint-enable oxc/no-async-await */
  return (
    <>
      {step === "info" && (
        <>
          <DialogHeader>
            <DialogTitle>Share chat</DialogTitle>
            <DialogDescription>
              {isPublic
                ? "This chat is currently public. Anyone with the link can view it."
                : "Make this chat public so you can share it with others."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="bg-muted/20 flex items-center gap-3 rounded-lg border p-3">
              {isPublic ? (
                <>
                  <div className="text-green-600">
                    <GlobeIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Public</div>
                    <div className="text-muted-foreground text-xs">
                      Anyone with the link can access this chat
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-muted-foreground">
                    <LockIcon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">Private</div>
                    <div className="text-muted-foreground text-xs">
                      Only you can access this chat
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {isPublic ? (
                <>
                  <Button
                    className="flex-1"
                    disabled={isPending}

                    // oxlint-disable-next-line typescript/no-misused-promises -- #585: Share, unshare, and clipboard actions catch failures and own their success/error feedback.
                    onClick={handleUnshare}
                    variant="outline"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="animate-spin" size={16} />
                        <span className="ml-2">Making Private...</span>
                      </>
                    ) : (
                      <>
                        <LockIcon size={16} />
                        <span className="ml-2">Make Private</span>
                      </>
                    )}
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={isPending}
                    onClick={() => setStep("shared")}
                  >
                    <GlobeIcon size={16} />
                    <span className="ml-2">Get Link</span>
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full"
                  disabled={isPending}

                  // oxlint-disable-next-line typescript/no-misused-promises -- #585: Share, unshare, and clipboard actions catch failures and own their success/error feedback.
                  onClick={handleShare}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      <span className="ml-2">Sharing...</span>
                    </>
                  ) : (
                    <>
                      <GlobeIcon size={16} />
                      <span className="ml-2">Share Chat</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </>
      )}

      {step === "shared" && (
        <>
          <DialogHeader>
            <DialogTitle>Share chat</DialogTitle>
            <DialogDescription>
              Copy the link below to share this chat with others.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center space-x-2">
            <div className="grid flex-1 gap-2">
              <label className="sr-only" htmlFor="link">
                Link
              </label>
              <input
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                defaultValue={`${globalThis.location.origin}/share/${chatId}`}
                id="link"
                readOnly
              />
            </div>
            <Button
              className="px-3"

              // oxlint-disable-next-line typescript/no-misused-promises -- #585: Share, unshare, and clipboard actions catch failures and own their success/error feedback.
              onClick={handleCopyLink}
              size="sm"
              type="submit"
            >
              <Copy size={16} />
              <span className="sr-only">Copy</span>
            </Button>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button onClick={() => setStep("info")} size="sm" variant="ghost">
              ← Back
            </Button>
            <Button
              disabled={isPending}

              // oxlint-disable-next-line typescript/no-misused-promises -- #585: Share, unshare, and clipboard actions catch failures and own their success/error feedback.
              onClick={handleUnshare}
              size="sm"
              variant="outline"
            >
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" size={16} />
                  <span className="ml-2">Making Private...</span>
                </>
              ) : (
                <>
                  <LockIcon size={16} />
                  <span className="ml-2">Make Private</span>
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </>
  );
};
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable max-lines-per-function, react-perf/jsx-no-new-function-as-prop, react/jsx-max-depth, typescript/strict-void-return */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ShareDialog: react-perf/jsx-no-new-function-as-prop: this event callback captures current render state; memoization requires a separately verified dependency contract; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

// Extracted dialog component that can be controlled externally
/* oxlint-disable react/forbid-component-props -- DialogContent accept the supplied styling props; preserve this composition's layout and appearance. */
const ShareDialog = ({
  open,
  onOpenChange,
  children,
  renderContent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children?: React.ReactNode;
  renderContent: (onClose: () => void) => React.ReactNode;
}): React.JSX.Element => {
  const handleDialogOpenChange = (isOpen: boolean): void => {
    onOpenChange(isOpen);
  };

  return (
    <Dialog onOpenChange={handleDialogOpenChange} open={open}>
      {children}
      <DialogContent className="sm:max-w-md">
        {open && renderContent(() => onOpenChange(false))}
      </DialogContent>
    </Dialog>
  );
};
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop, react/no-multi-comp, typescript/prefer-readonly-parameter-types */

/* oxlint-disable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types -- ShareButton: react/jsx-max-depth: the existing accessible component hierarchy preserves layout, provider, and interaction boundaries; react/no-multi-comp: these related render helpers share this feature module and its local state and props contract; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/forbid-component-props -- Button, PopoverContent accept the supplied styling props; preserve this composition's layout and appearance. */
const ShareButton = ({
  className,
  renderContent,
}: {
  renderContent: (onClose: () => void) => React.ReactNode;
} & React.ComponentProps<typeof Button>): React.JSX.Element => {
  const [open, setOpen] = useState(false);
  const { data: session } = useSession();
  const isAuthenticated = Boolean(session?.user);

  const triggerButton = (
    <Button className={cn("", className)} size="sm" variant="outline">
      <Share size={16} />
      <span className="sr-only">Share chat</span>
    </Button>
  );

  if (!isAuthenticated) {
    return (
      <Popover>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent align="start" className="w-80 p-0">
          <LoginPrompt
            description="Control who can see your conversations and share them with others."
            title="Sign in to share your chat"
          />
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <ShareDialog
      onOpenChange={setOpen}
      open={open}
      renderContent={renderContent}
    >
      <DialogTrigger asChild>{triggerButton}</DialogTrigger>
    </ShareDialog>
  );
};
/* oxlint-enable react/forbid-component-props */
/* oxlint-enable react/jsx-max-depth, react/no-multi-comp, typescript/prefer-readonly-parameter-types */
export { ShareButton, ShareDialog, ShareDialogView };
