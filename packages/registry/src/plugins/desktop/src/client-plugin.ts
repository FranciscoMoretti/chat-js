"use client";
import { definePlugin, slot } from "@/lib/ui-slots";
import { LayoutEffects } from "@/components/layout-slots";
import { ElectronAuthHandler } from "./auth-handler";

export const desktopClient = definePlugin({
  id: "desktop",
  slots: [slot(LayoutEffects, ElectronAuthHandler)],
});
