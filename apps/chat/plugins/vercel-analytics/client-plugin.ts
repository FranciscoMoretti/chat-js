"use client";
import { definePlugin, slot } from "@/lib/ui-slots";
import { LayoutEffects } from "@/components/layout-slots";
import { Component } from "./component";

export const vercelAnalyticsClient = definePlugin({
  id: "vercel-analytics",
  slots: [slot(LayoutEffects, Component)],
});
