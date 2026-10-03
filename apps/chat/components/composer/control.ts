import type { ComponentType, Dispatch, SetStateAction } from "react";

import type { UiToolName } from "@/lib/ai/types";
/* oxlint-disable import/group-exports -- ComposerControlProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export interface ComposerControlProps {
  disabled?: boolean;
  selectedModelId: string;
  selectedTool: UiToolName | null;
  onToolChange: Dispatch<SetStateAction<UiToolName | null>>;
  onAttach: (accept: string, capture?: "environment" | "user") => void;
}
/* oxlint-enable import/group-exports */

/* oxlint-disable import/group-exports -- ComposerControl: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers;  */

export interface ComposerControl {
  id: string;
  Component: ComponentType<ComposerControlProps> & {
    /** Controls that can render nothing expose their availability to the menu. */
    isAvailable?: (isMobile: boolean) => boolean;
  };
}
/* oxlint-enable import/group-exports */
