import type { ComponentProps, ReactNode } from "react";

export interface EditableBubbleProps {
  readonly button?: ComponentProps<"button">;
  readonly children: ReactNode;
}
