"use client";
import { definePlugin, slot } from "@/chatjs/core/ui/slots";
import { LayoutEffects } from "@/components/layout-slots";
import { Component } from "./component";

export const vercelSpeedInsightsClient = definePlugin({
  id: "vercel-speed-insights",
  slots: [slot(LayoutEffects, Component)],
});
