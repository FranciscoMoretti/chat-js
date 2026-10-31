"use client";
import { Plugins } from "@/lib/ui-slots";
import { LayoutEffects } from "@/components/layout-slots";
import { layoutPlugins } from "@/integrations/layout";

export const LayoutPlugins = () => (
  <Plugins plugins={layoutPlugins}>
    <LayoutEffects />
  </Plugins>
);
