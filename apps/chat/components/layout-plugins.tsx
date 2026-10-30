"use client";
import { Plugins } from "@/lib/ui-slots";
import { LayoutEffects } from "@/components/layout-slots";
import { installedLayoutPlugins } from "@/chatjs/generated/installed-layout";

export const LayoutPlugins = () => (
  <Plugins plugins={installedLayoutPlugins}>
    <LayoutEffects />
  </Plugins>
);
