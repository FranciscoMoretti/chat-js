import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { searchRouter } from "./router";

export default function search() {
  return {
    id: "search",
    routers: { search: searchRouter },
  } satisfies ChatPlugin;
}
