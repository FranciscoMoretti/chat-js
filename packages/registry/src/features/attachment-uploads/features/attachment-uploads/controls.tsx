"use client";

import { Camera, Paperclip } from "lucide-react";
import { toast } from "sonner";

import type { ComposerControlProps } from "@/components/composer/control";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import { installedFeatures } from "@/features/installed";
import { useIsMobile } from "@/hooks/use-mobile";
import { config } from "@/lib/config";
import { useSession } from "@/providers/session-provider";

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
  if (!installedFeatures.has("attachment-uploads")) {
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
        onAttach(Object.keys(config.attachments.acceptedTypes).join(","));
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
  if (!installedFeatures.has("attachment-uploads") || !mobile) {
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

AttachFilesControl.isAvailable = () =>
  installedFeatures.has("attachment-uploads");
TakePhotoControl.isAvailable = (mobile: boolean) =>
  installedFeatures.has("attachment-uploads") && mobile;
