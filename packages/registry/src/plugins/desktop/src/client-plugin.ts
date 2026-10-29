"use client";
import { definePlugin } from "@/lib/ui-slots";
import { LayoutEffects } from "@/components/layout-slots";
import { ElectronAuthHandler } from "./auth-handler";

export const desktopClient = definePlugin({
  id: "desktop",
  contributions: [LayoutEffects.contribute(ElectronAuthHandler)],
});
