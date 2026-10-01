import type { AnyTRPCRouter } from "@trpc/server";
import type { ComponentType, Dispatch, SetStateAction } from "react";

import type { ComposerControl } from "@/components/composer/control";
import type { SettingsItem } from "@/components/settings/settings-item";
import type { DraftAttachment } from "@/lib/eve/draft";

/** Preserve inferred procedure types: use `satisfies`, never annotate the map. */
export type InstalledRouters = Record<string, AnyTRPCRouter> & {
  credits?: never;
  eve?: never;
  project?: never;
  settings?: never;
};

/** Application-owned composition; sync adds defaults only during create/add. */
export interface FeatureUiContribution {
  composerControls: readonly ComposerControl[];
  settingsItems: readonly SettingsItem[];
}

/** D owns picker/camera/paste/drop behavior; core owns persisted attachments. */
export interface AttachmentUploadState {
  attachments: DraftAttachment[];
  setAttachments: Dispatch<SetStateAction<DraftAttachment[]>>;
}
export interface AttachmentUploadBehavior extends AttachmentUploadState {
  upload: (files: File[]) => Promise<void>;
  uploadQueue: string[];
}
export interface AttachmentUploadIntegration {
  useUploads: (state: AttachmentUploadState) => AttachmentUploadBehavior;
  controls: readonly ComposerControl[];
}

/** E supplies no-prop leaf components; app layout determines placement. */
export type InstalledLayoutComponent = ComponentType;

/** E supplies optional registrations; core lifecycle runs independently. */
export type InstrumentationRegistration = (context: {
  appPrefix: string;
  runtime: string | undefined;
}) => void | Promise<void>;
