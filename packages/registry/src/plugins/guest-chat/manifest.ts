import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const guestChatFiles = [
  "chatjs/plugins/guest-chat/cleanup.ts",
  "chatjs/plugins/guest-chat/guest-auth.ts",
  "chatjs/plugins/guest-chat/guest-body.ts",
  "chatjs/plugins/guest-chat/guest-cleanup-auth.ts",
  "chatjs/plugins/guest-chat/guest-cleanup.ts",
  "chatjs/plugins/guest-chat/guest-credential.ts",
  "chatjs/plugins/guest-chat/guest-ip.ts",
  "chatjs/plugins/guest-chat/guest-model.ts",
  "chatjs/plugins/guest-chat/guest-policy.ts",
  "chatjs/plugins/guest-chat/guest-queries.ts",
  "chatjs/plugins/guest-chat/guest-scheduler.ts",
  "chatjs/plugins/guest-chat/guest-schema.ts",
  "chatjs/plugins/guest-chat/routes/create-session.ts",
  "chatjs/plugins/guest-chat/server-plugin.ts",
  "chatjs/plugins/guest-chat/session-profile.ts",
  "chatjs/plugins/guest-chat/signed-out.tsx",
];
const guestChatDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "guest-chat",
  kind: "plugin",
  files: [...guestChatFiles, "app/api/eve-guest/route.ts"],
  databaseSchemas: ["chatjs/plugins/guest-chat/guest-schema.ts"],
  signedOut: { export: "GuestChatScreen" },
  sessionProfile: {
    export: "guestSessionProfile",
    authenticator: "chatjs-disposable-guest",
  },
  cleanup: { export: "guestCleanup", id: "guest-chat" },
  server: { export: "guestChat", instrumentation: true },
});
const guestChatItem: RegistryItem = {
  name: "guest-chat",
  type: "registry:item",
  description:
    "Disposable text chat for visitors with isolated sessions and bounded cleanup",
  dependencies: ["ai", "drizzle-orm", "zod"],
  files: [
    ...guestChatFiles.map((file) => ({
      path: `src/plugins/guest-chat/src/${file.slice("chatjs/plugins/guest-chat/".length)}`,
      target: `~/${file}`,
      type: "registry:file" as const,
    })),
    {
      path: "src/plugins/guest-chat/adapters/app/api/eve-guest/route.ts",
      target: "~/app/api/eve-guest/route.ts",
      type: "registry:file",
    },
  ],
  meta: { chatjs: guestChatDefinition },
};
export { guestChatItem, guestChatDefinition, guestChatFiles };
