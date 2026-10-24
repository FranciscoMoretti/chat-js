import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { Component } from "./component";

export const vercelSpeedInsightsClient = () =>
  ({
    id: "vercel-speed-insights",
    layout: Component,
  }) satisfies ChatClientPlugin;
