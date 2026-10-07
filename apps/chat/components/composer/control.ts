import type { ComponentType, Dispatch, SetStateAction } from "react";

import type { UiToolName } from "@/lib/ai/types";

interface ComposerControlProps {
  disabled?: boolean;
  selectedModelId: string;
  selectedTool: UiToolName | null;
  onToolChange: Dispatch<SetStateAction<UiToolName | null>>;
  onAttach: (accept: string, capture?: "environment" | "user") => void;
}

interface ComposerControl {
  id: string;
  Component: ComponentType<ComposerControlProps> & {
    /** Controls that can render nothing expose their availability to the menu. */
    isAvailable?: (isMobile: boolean) => boolean;
  };
}
/* oxlint-disable import/no-named-export -- Keep the named type bindings (ComposerControl, ComposerControlProps); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
export type { ComposerControl, ComposerControlProps };
/* oxlint-enable import/no-named-export */
