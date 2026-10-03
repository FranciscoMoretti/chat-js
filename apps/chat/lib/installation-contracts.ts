import type { AnyTRPCRouter } from "@trpc/server";
import type { ComponentType, HTMLAttributes, ReactNode } from "react";

import type {
  ComposerControl,
  ComposerControlProps,
} from "@/components/composer/control";
import type { SettingsItem } from "@/components/settings/settings-item";
import type { DraftAttachment } from "@/lib/eve/draft";

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): InstalledRouters stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named InstalledRouters API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** Preserve inferred procedure types: use `satisfies`, never annotate the map. */
export type InstalledRouters = Record<string, AnyTRPCRouter> & {
  credits?: never;
  eve?: never;
  project?: never;
  settings?: never;
};
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): FeatureUiContribution stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named FeatureUiContribution API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** Application-owned composition; sync adds defaults only during create/add. */
export interface FeatureUiContribution {
  composerControls: readonly ComposerControl[];
  settingsItems: readonly SettingsItem[];
}
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): AttachmentUploadInput stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named AttachmentUploadInput API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** D owns picker/camera/paste/drop behavior; core owns persisted attachments. */
export interface AttachmentUploadInput {
  attachmentCount: number;
  onUploaded: (attachment: DraftAttachment) => void;
}
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): AttachmentUploadBehavior stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named AttachmentUploadBehavior API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export interface AttachmentUploadBehavior {
  uploadQueue: string[];
  composer?: (disabled: boolean) => {
    rootProps: HTMLAttributes<HTMLDivElement>;
    input: ReactNode;
    onAttach: ComposerControlProps["onAttach"];
  };
}
/* oxlint-enable import/group-exports */
/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): AttachmentUploadIntegration stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named AttachmentUploadIntegration API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): AttachmentUploadIntegration accepts input: AttachmentUploadInput; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
export interface AttachmentUploadIntegration {
  useUploads: (input: AttachmentUploadInput) => AttachmentUploadBehavior;
  controls: readonly ComposerControl[];
}
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */

/* oxlint-disable import/group-exports  --
 * import/group-exports (#523): InstalledLayoutComponent stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named InstalledLayoutComponent API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
/** E supplies no-prop leaf components; app layout determines placement. */
export type InstalledLayoutComponent = ComponentType;
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports, typescript/prefer-readonly-parameter-types  --
 * import/group-exports (#523): InstrumentationRegistration stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named InstrumentationRegistration API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * typescript/prefer-readonly-parameter-types (#565): InstrumentationRegistration accepts context: { appPrefix: string; runtime: string | undefined; }; deep-readonly conversion changes assignability at its SDK/public API boundary and needs an ownership-contract migration.
 */
/** E supplies optional registrations; core lifecycle runs independently. */
export type InstrumentationRegistration = (context: {
  appPrefix: string;
  runtime: string | undefined;
}) => void | Promise<void>;
/* oxlint-enable import/group-exports, typescript/prefer-readonly-parameter-types */
