import type { AnyTRPCRouter } from "@trpc/server";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentType, HTMLAttributes, ReactNode } from "react";
/* oxlint-enable sort-imports */

import type {
  ComposerControl,
  ComposerControlProps,
} from "@/components/composer/control";
import type { DraftAttachment } from "@/lib/eve/draft";

/** Preserve inferred procedure types: use `satisfies`, never annotate the map. */
type InstalledRouters = Record<string, AnyTRPCRouter> & {
  credits?: never;
  eve?: never;
  project?: never;
  settings?: never;
};

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
/* oxlint-disable import/no-named-export -- Keep the existing installation composition bindings (AttachmentUploadBehavior, AttachmentUploadInput, AttachmentUploadIntegration, InstalledLayoutComponent, InstalledRouters, InstrumentationRegistration); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
export type {
  AttachmentUploadBehavior,
  AttachmentUploadInput,
  AttachmentUploadIntegration,
  InstalledLayoutComponent,
  InstalledRouters,
  InstrumentationRegistration,
};
/* oxlint-enable import/no-named-export */
