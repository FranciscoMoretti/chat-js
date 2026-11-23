"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { LayoutEffects } from "@/components/layout-slots";
import { ElectronAuthHandler } from "./auth-handler";

export const layoutUi = definePlugin({
  id: "desktop",
  slots: [slot(LayoutEffects, ElectronAuthHandler)],
});
