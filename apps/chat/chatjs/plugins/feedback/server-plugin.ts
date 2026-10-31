import type { ChatPlugin } from "@/chatjs/core/installation/plugin";
import { feedbackRouter } from "./router";

export const feedback = () =>
  ({
    id: "feedback",
    routers: { feedback: feedbackRouter },
  }) satisfies ChatPlugin;
