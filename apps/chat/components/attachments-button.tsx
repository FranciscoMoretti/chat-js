"use client";

import { CameraIcon, FileIcon, ImageIcon, PlusIcon } from "lucide-react";
import { memo, useCallback, useState } from "react";
import type { MutableRefObject } from "react";

import { PromptInputButton } from "@/components/ai-elements/prompt-input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSession } from "@/providers/session-provider";

const PureAttachmentsButton = ({
  fileInputRef,
  status,
  acceptAll,
  acceptImages,
  acceptFiles,
}: {
  fileInputRef: MutableRefObject<HTMLInputElement | null>;
  status: "ready" | "submitted" | "streaming" | "error";
  acceptAll: string;
  acceptImages: string;
  acceptFiles: string;
}) => {
  const { data: session } = useSession();
  const isMobile = useIsMobile();
  const isAnonymous = !session?.user;
  const [showLoginPopover, setShowLoginPopover] = useState(false);

  const triggerFileInput = useCallback(
    (accept: string, capture?: "environment" | "user") => {
      const input = fileInputRef.current;
      if (!input) {
        return;
      }
      input.accept = accept;
      if (capture) {
        input.capture = capture;
      } else {
        input.removeAttribute("capture");
      }
      input.click();
    },
    [fileInputRef]
  );

  const handleDesktopClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (isAnonymous) {
      setShowLoginPopover(true);
      return;
    }
    triggerFileInput(acceptAll);
  };

  if (isMobile) {
    if (isAnonymous) {
      return (
        <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="size-8"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={() => setShowLoginPopover(true)}
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </PromptInputButton>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 p-0">
            <LoginPrompt
              description="You can attach images and PDFs to your messages for the AI to analyze."
              title="Sign in to attach files"
            />
          </PopoverContent>
        </Popover>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <PromptInputButton
            className="size-8"
            data-testid="attachments-button"
            disabled={status !== "ready"}
            variant="ghost"
          >
            <PlusIcon className="size-4" />
          </PromptInputButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem onClick={() => triggerFileInput(acceptImages)}>
            <ImageIcon />
            Add photos
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => triggerFileInput(acceptImages, "environment")}
          >
            <CameraIcon />
            Take photo
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => triggerFileInput(acceptFiles)}>
            <FileIcon />
            Add files
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Popover onOpenChange={setShowLoginPopover} open={showLoginPopover}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <PromptInputButton
              className="size-8 @[500px]:size-10"
              data-testid="attachments-button"
              disabled={status !== "ready"}
              onClick={handleDesktopClick}
              variant="ghost"
            >
              <PlusIcon className="size-4" />
            </PromptInputButton>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Add Files</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80 p-0">
        <LoginPrompt
          description="You can attach images and PDFs to your messages for the AI to analyze."
          title="Sign in to attach files"
        />
      </PopoverContent>
    </Popover>
  );
};

export const AttachmentsButton = memo(PureAttachmentsButton);
