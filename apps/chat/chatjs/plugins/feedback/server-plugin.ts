import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { feedbackRouter } from "./router";

export default function feedback() {
  return {
    id: "feedback",
    routers: { feedback: feedbackRouter },
  } satisfies ChatPlugin;
}
