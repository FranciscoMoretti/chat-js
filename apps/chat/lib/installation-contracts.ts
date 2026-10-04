import type { AnyTRPCRouter } from "@trpc/server";
import type { ComponentType, HTMLAttributes, ReactNode } from "react";

import type {
  ComposerControl,
  ComposerControlProps,
} from "@/components/composer/control";
import type { SettingsItem } from "@/components/settings/settings-item";
import type { DraftAttachment } from "@/lib/eve/draft";

/** Preserve inferred procedure types: use `satisfies`, never annotate the map. */
type InstalledRouters = Record<string, AnyTRPCRouter> & {
  credits?: never;
  eve?: never;
  project?: never;
  settings?: never;
};

/** Application-owned composition; sync adds defaults only during create/add. */
interface FeatureUiContribution {
  composerControls: readonly ComposerControl[];
  settingsItems: readonly SettingsItem[];
}

/** D owns picker/camera/paste/drop behavior; core owns persisted attachments. */
interface AttachmentUploadInput {
  attachmentCount: number;
  onUploaded: (attachment: DraftAttachment) => void;
}

interface AttachmentUploadBehavior {
  uploadQueue: string[];
  composer?: (disabled: boolean) => {
    rootProps: HTMLAttributes<HTMLDivElement>;
    input: ReactNode;
    onAttach: ComposerControlProps["onAttach"];
  };
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): AttachmentUploadIntegration accepts input: AttachmentUploadInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
interface AttachmentUploadIntegration {
  useUploads: (input: AttachmentUploadInput) => AttachmentUploadBehavior;
  controls: readonly ComposerControl[];
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */

/** E supplies no-prop leaf components; app layout determines placement. */
type InstalledLayoutComponent = ComponentType;

/* oxlint-disable typescript/prefer-readonly-parameter-types -- typescript/prefer-readonly-parameter-types (#565): InstrumentationRegistration accepts context: { appPrefix: string; runtime: string | undefined; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration. */
/** E supplies optional registrations; core lifecycle runs independently. */
type InstrumentationRegistration = (context: {
  appPrefix: string;
  runtime: string | undefined;
}) => void | Promise<void>;
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export type {
  AttachmentUploadBehavior,
  AttachmentUploadInput,
  AttachmentUploadIntegration,
  FeatureUiContribution,
  InstalledLayoutComponent,
  InstalledRouters,
  InstrumentationRegistration,
};
