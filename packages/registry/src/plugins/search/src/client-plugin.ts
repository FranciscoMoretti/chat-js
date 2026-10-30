"use client";
import { definePlugin, slot } from "@/lib/ui-slots";
import { SidebarHeaderItems } from "@/components/chat-slots";
import { SearchSidebarItem } from "./sidebar-item";

export const searchClient = definePlugin({
  id: "search",
  slots: [slot(SidebarHeaderItems, SearchSidebarItem)],
});
