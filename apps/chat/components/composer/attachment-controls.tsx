"use client";

import { Camera, Paperclip } from "lucide-react";
import { toast } from "sonner";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import { useIsMobile } from "@/hooks/use-mobile";
import { config } from "@/lib/config";
import { useSession } from "@/providers/session-provider";

import type { ComposerControlProps } from "./control";

const loginPrompt = (
  <LoginPrompt
    title="Sign in to attach files"
    description="Sign in to use this feature in your conversation."
  />
);

export const AttachFilesControl = ({
  disabled,
  onAttach,
}: ComposerControlProps) => {
  const { data: session } = useSession();
  if (!config.features.attachments) {
    return null;
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => {
        if (!session?.user) {
          toast(loginPrompt);
          return;
        }
        onAttach("image/jpeg,image/png,application/pdf");
      }}
    >
      <Paperclip />
      Attach files
    </DropdownMenuItem>
  );
};

export const TakePhotoControl = ({
  disabled,
  onAttach,
}: ComposerControlProps) => {
  const mobile = useIsMobile();
  const { data: session } = useSession();
  if (!config.features.attachments || !mobile) {
    return null;
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => {
        if (!session?.user) {
          toast(loginPrompt);
          return;
        }
        onAttach("image/jpeg,image/png", "environment");
      }}
    >
      <Camera />
      Take photo
    </DropdownMenuItem>
  );
};
