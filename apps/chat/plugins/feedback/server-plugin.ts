import type { ChatPlugin } from "@/lib/plugin-contracts";
import { feedbackRouter } from "./router";

export const feedback = () =>
  ({
    id: "feedback",
    routers: { feedback: feedbackRouter },
  }) satisfies ChatPlugin;
