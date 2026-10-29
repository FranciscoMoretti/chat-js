"use client";
import { definePlugin } from "@/lib/ui-slots";
import { SidebarHeaderItems } from "@/components/chat-slots";
import { SearchSidebarItem } from "./sidebar-item";

export const searchClient = definePlugin({
  id: "search",
  contributions: [SidebarHeaderItems.contribute(SearchSidebarItem)],
});
