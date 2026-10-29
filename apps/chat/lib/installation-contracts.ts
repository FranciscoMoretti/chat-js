import type { HTMLAttributes, ReactNode } from "react";
import type { ComposerControlProps } from "@/components/composer/control";

import type { AnyTRPCRouter } from "@trpc/server";
import type { DraftAttachment } from "@/lib/eve/draft";

/** Preserve inferred procedure types: use `satisfies`, never annotate the map. */
type InstalledRouters = Record<string, AnyTRPCRouter> & {
  eve?: never;
};

/** Installed once; only filters the picker. Core retains catalog and eligibility. */
type ModelVisibility = (
  defaultEnabledIds: ReadonlySet<string>
) => ReadonlySet<string>;

/** D owns picker/camera/paste/drop behavior; core owns persisted attachments. */
interface AttachmentUploadInput {
  readonly attachmentCount: number;
  readonly onUploaded: (attachment: Readonly<DraftAttachment>) => void;
}

interface AttachmentUploadBehavior {
  uploadQueue: string[];
  composer?: (disabled: boolean) => {
    rootProps: HTMLAttributes<HTMLDivElement>;
    input: ReactNode;
    onAttach: ComposerControlProps["onAttach"];
  };
}

interface AttachmentUploadIntegration {
  useUploads: (input: AttachmentUploadInput) => AttachmentUploadBehavior;
}

/** E supplies optional registrations; core lifecycle runs independently. */
type InstrumentationRegistration = (context: {
  readonly appPrefix: string;
  readonly runtime: string | undefined;
}) => void | Promise<void>;
export type {
  ModelVisibility,
  AttachmentUploadBehavior,
  AttachmentUploadInput,
  AttachmentUploadIntegration,
  InstalledRouters,
  InstrumentationRegistration,
};
