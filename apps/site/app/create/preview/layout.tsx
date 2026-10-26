import { PreviewStyle } from "@/vendor/shadcn-create/components/preview-style";
import type { ReactNode } from "react";
import { ActionMenuScript } from "@/vendor/shadcn-create/components/action-menu";
import { HistoryScript } from "@/vendor/shadcn-create/components/history-buttons";
import { DarkModeScript } from "@/vendor/shadcn-create/components/mode-switcher";
import { RandomizeScript } from "@/vendor/shadcn-create/components/random-button";
import { OpenPresetScript } from "@/vendor/shadcn-create/components/open-preset";

const PreviewLayout = ({ children }: Readonly<{ children: ReactNode }>) => (
  <>
    <PreviewStyle />
    <ActionMenuScript />
    <HistoryScript />
    <DarkModeScript />
    <RandomizeScript />
    <OpenPresetScript />
    {children}
  </>
);
export default PreviewLayout;
