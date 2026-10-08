"use client";
import { Camera, Paperclip } from "lucide-react";
import React from "react";
import { toast } from "sonner";

import type { ComposerControlProps } from "@/components/composer/control";
/* oxlint-disable-next-line sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import { installedFeatures } from "@/features/installed";
import { useIsMobile } from "@/hooks/use-mobile";
/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { config } from "@/lib/config";
/* oxlint-enable sort-imports */
import { useSession } from "@/providers/session-provider";

type AttachControlProps = Readonly<
  Pick<ComposerControlProps, "disabled" | "onAttach">
>;

const loginPrompt = (
  <LoginPrompt
    title="Sign in to attach files"
    description="Sign in to use this feature in your conversation."
  />
);
/* oxlint-disable react/jsx-no-literals -- AttachFilesControl renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */

/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
const AttachFilesControl = ({
  disabled,
  onAttach,
}: AttachControlProps): React.JSX.Element | null => {
  const { data: session } = useSession();
  if (!installedFeatures.has("attachment-uploads")) {
    return null;
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(): void => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the existing nullish guard on session when checking its user.
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-disable react/jsx-no-literals -- TakePhotoControl renders authored interface labels, status copy and display punctuation; no translation-layer contract is defined here. */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable unicorn/no-null */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
const TakePhotoControl = ({
  disabled,
  onAttach,
}: AttachControlProps): React.JSX.Element | null => {
  const mobile = useIsMobile();
  const { data: session } = useSession();
  if (!installedFeatures.has("attachment-uploads") || !mobile) {
    return null;
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(): void => {
        // oxlint-disable-next-line oxc/no-optional-chaining -- Preserve the existing nullish guard on session when checking its user.
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
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable react/no-multi-comp */

AttachFilesControl.isAvailable = (): boolean =>
  installedFeatures.has("attachment-uploads");
TakePhotoControl.isAvailable = (mobile: boolean): boolean =>
  installedFeatures.has("attachment-uploads") && mobile;
/* oxlint-disable import/no-named-export -- Keep the existing named module bindings (AttachFilesControl, TakePhotoControl); the enabled import/no-default-export convention rejects the default-export alternative. */
export { AttachFilesControl, TakePhotoControl };
/* oxlint-enable import/no-named-export */
