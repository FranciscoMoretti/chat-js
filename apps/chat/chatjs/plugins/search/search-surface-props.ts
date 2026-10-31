import type { ReactNode } from "react";

export interface SearchSurfaceProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly trigger: ReactNode;
  readonly children: ReactNode;
}
