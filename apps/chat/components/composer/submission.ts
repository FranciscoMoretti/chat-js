import type { ReactElement, ReactNode } from "react";

/** The implementation retains the request and owns any recovery/retry policy. */
export interface ComposerSubmission {
  readonly submit: () => Promise<void>;
  readonly pending: boolean;
  readonly error?: string;
  readonly recovery?: ReactElement;
  readonly preview?: ReactNode;
}
