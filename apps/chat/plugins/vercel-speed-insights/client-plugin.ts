"use client";
import { definePlugin } from "@/lib/ui-slots";
import { LayoutEffects } from "@/components/layout-slots";
import { Component } from "./component";

export const vercelSpeedInsightsClient = definePlugin({
  id: "vercel-speed-insights",
  contributions: [LayoutEffects.contribute(Component)],
});
