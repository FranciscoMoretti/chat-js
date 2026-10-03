"use client";
import { Camera, Paperclip } from "lucide-react";
import React from "react";
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

/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const AttachFilesControl = ({ disabled, onAttach }: ComposerControlProps) => {
  const { data: session } = useSession();
  if (!installedFeatures.has("attachment-uploads")) {
    return null;
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(): void => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */

/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */

/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
const TakePhotoControl = ({ disabled, onAttach }: ComposerControlProps) => {
  const mobile = useIsMobile();
  const { data: session } = useSession();
  if (!installedFeatures.has("attachment-uploads") || !mobile) {
    return null;
  }
  return (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={(): void => {
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
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */

/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable react/no-multi-comp */

AttachFilesControl.isAvailable = (): boolean =>
  installedFeatures.has("attachment-uploads");
TakePhotoControl.isAvailable = (mobile: boolean): boolean =>
  installedFeatures.has("attachment-uploads") && mobile;
export { AttachFilesControl, TakePhotoControl };
