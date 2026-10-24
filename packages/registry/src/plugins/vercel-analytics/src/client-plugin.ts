import type { ChatClientPlugin } from "@/lib/plugin-contracts";
import { Component } from "./component";

export const vercelAnalyticsClient = () =>
  ({ id: "vercel-analytics", layout: Component }) satisfies ChatClientPlugin;
