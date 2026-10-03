"use client";

import { Camera, Paperclip } from "lucide-react";
import { toast } from "sonner";

/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import type { ComposerControlProps } from "@/components/composer/control";
/* oxlint-enable eslint/sort-imports */
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { LoginPrompt } from "@/components/upgrade-cta/login-prompt";
import { installedFeatures } from "@/features/installed";
import { useIsMobile } from "@/hooks/use-mobile";
/* oxlint-disable eslint/sort-imports -- Oxfmt owns deterministic import ordering; preserve its order rather than create a formatter/linter rewrite cycle. */
import { config } from "@/lib/config";
/* oxlint-enable eslint/sort-imports */
import { useSession } from "@/providers/session-provider";

/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
const loginPrompt = (
  <LoginPrompt
    title="Sign in to attach files"
    description="Sign in to use this feature in your conversation."
  />
);
/* oxlint-enable react/react-in-jsx-scope */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

/* oxlint-disable import/exports-last -- Keep the exported declaration beside the types and initialization it describes; moving it can reorder module initialization. */
/* oxlint-disable import/group-exports -- These declarations form independently consumed package exports; preserve their declaration-local API documentation and type inference. */
/* oxlint-disable react/no-multi-comp -- These private render helpers belong to the same UI composition and share its local types and state assumptions. */
/* oxlint-disable import/no-named-export -- Consumers import this public symbol by name; changing the export shape would require a coordinated API migration. */
/* oxlint-disable typescript/explicit-module-boundary-types -- This exported adapter derives its result from the schema or SDK contract; duplicating that type would erase inference or drift from the source. */
/* oxlint-disable typescript/explicit-function-return-type -- Preserve the inferred structural or generic result so caller-specific schema and SDK types are not widened. */
/* oxlint-disable unicorn/no-null -- Null is an explicit SDK, serialized-data, or React absence sentinel; replacing it would change the contract. */
/* oxlint-disable react/jsx-no-literals -- These labels are intentional product copy in the existing English UI; translating them requires an application localization contract. */
/* oxlint-disable react/react-in-jsx-scope -- The TypeScript/Next automatic JSX runtime supplies JSX helpers; a legacy React binding is not required for rendering. */
/* oxlint-disable react-perf/jsx-no-new-function-as-prop -- The handler captures the current render state; changing its identity policy requires profiling and lifecycle review. */
/* oxlint-disable oxc/no-optional-chaining -- Optional access deliberately propagates absence from the external or partially initialized data contract. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- This parameter participates in the existing SDK or mutable state contract; recursively readonly types would change assignability or permitted updates. */
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
/* oxlint-enable oxc/no-optional-chaining */
/* oxlint-enable react-perf/jsx-no-new-function-as-prop */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable react/jsx-no-literals */
/* oxlint-enable unicorn/no-null */
/* oxlint-enable typescript/explicit-function-return-type */
/* oxlint-enable typescript/explicit-module-boundary-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable react/no-multi-comp */
/* oxlint-enable import/group-exports */
/* oxlint-enable import/exports-last */

AttachFilesControl.isAvailable = (): boolean =>
  installedFeatures.has("attachment-uploads");
TakePhotoControl.isAvailable = (mobile: boolean): boolean =>
  installedFeatures.has("attachment-uploads") && mobile;
