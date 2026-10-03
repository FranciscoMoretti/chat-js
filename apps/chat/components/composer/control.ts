import type { ComponentType, Dispatch, SetStateAction } from "react";

import type { UiToolName } from "@/lib/ai/types";
/* oxlint-disable import/group-exports, import/no-named-export -- ComposerControlProps: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export interface ComposerControlProps {
  disabled?: boolean;
  selectedModelId: string;
  selectedTool: UiToolName | null;
  onToolChange: Dispatch<SetStateAction<UiToolName | null>>;
  onAttach: (accept: string, capture?: "environment" | "user") => void;
}
/* oxlint-enable import/group-exports, import/no-named-export */

/* oxlint-disable import/group-exports, import/no-named-export -- ComposerControl: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; import/no-named-export: existing callers import this public component, type, or hook by name. */

export interface ComposerControl {
  id: string;
  Component: ComponentType<ComposerControlProps> & {
    /** Controls that can render nothing expose their availability to the menu. */
    isAvailable?: (isMobile: boolean) => boolean;
  };
}
/* oxlint-enable import/group-exports, import/no-named-export */
