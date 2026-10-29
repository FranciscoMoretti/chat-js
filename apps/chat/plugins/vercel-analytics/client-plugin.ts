"use client";
import { definePlugin } from "@/lib/ui-slots";
import { LayoutEffects } from "@/components/layout-slots";
import { Component } from "./component";

export const vercelAnalyticsClient = definePlugin({
  id: "vercel-analytics",
  contributions: [LayoutEffects.contribute(Component)],
});
