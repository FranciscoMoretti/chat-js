"use client";
import { Camera, Paperclip } from "lucide-react";
import type { ComposerControlProps } from "@/components/composer/control";
import React from "react";
import { toast } from "sonner";

import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import { installedPlugins } from "@/integrations/plugin-catalog";
import { useIsMobile } from "@/hooks/use-mobile";
import { config } from "@/lib/config";
import { useSession } from "@/providers/session-provider";

type AttachControlProps = Readonly<
  Pick<ComposerControlProps, "disabled" | "onAttach">
>;

const loginPrompt = (
  <LoginPrompt
    title="Sign in to attach files"
    description="Sign in to use this plugin in your conversation."
  />
);

const AttachFilesControl = ({
  disabled,
  onAttach,
}: AttachControlProps): React.JSX.Element | null => {
  const { data: session } = useSession();
  if (!installedPlugins.has("attachment-uploads")) {
    return null;
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={(): void => {
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

const TakePhotoControl = ({
  disabled,
  onAttach,
}: AttachControlProps): React.JSX.Element | null => {
  const mobile = useIsMobile();
  const { data: session } = useSession();
  if (!installedPlugins.has("attachment-uploads") || !mobile) {
    return null;
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onClick={(): void => {
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

AttachFilesControl.isAvailable = (): boolean =>
  installedPlugins.has("attachment-uploads");
TakePhotoControl.isAvailable = (mobile: boolean): boolean =>
  installedPlugins.has("attachment-uploads") && mobile;
export { AttachFilesControl, TakePhotoControl };
