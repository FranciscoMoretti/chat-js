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

/** Headless upload policy and delivery; callers own attachment state and UI. */
interface AttachmentUploadInput {
  readonly attachmentCount: number;
  readonly onError?: (message: string) => void;
  readonly onUploaded: (attachment: Readonly<DraftAttachment>) => void;
}

interface AttachmentUploadBehavior {
  readonly enabled: boolean;
  readonly busy: boolean;
  readonly uploadQueue: readonly string[];
  readonly errors: readonly string[];
  readonly enqueue: (files: readonly File[]) => Promise<void>;
}

interface AttachmentUploadIntegration {
  useUploads: (input: AttachmentUploadInput) => AttachmentUploadBehavior;
}

/** Optional startup registrations; core lifecycle runs independently. */
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
