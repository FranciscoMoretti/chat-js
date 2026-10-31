import type { ChatPlugin } from "@/chatjs/core/installation/plugin";

export const guestChat = () =>
  ({
    id: "guest-chat",
    instrumentation: async () => {
      if (process.env.NEXT_RUNTIME === "nodejs") {
        const { startLocalEveGuestCleanup } = await import("./guest-scheduler");
        startLocalEveGuestCleanup();
      }
    },
  }) satisfies ChatPlugin;
