import { definePluginItem } from "../define-item";

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
  "chatjs/plugins/guest-chat/guest-retention.ts",
  "chatjs/plugins/guest-chat/guest-queries.ts",
  "chatjs/plugins/guest-chat/guest-scheduler.ts",
  "chatjs/plugins/guest-chat/guest-schema.ts",
  "chatjs/plugins/guest-chat/instrumentation.ts",
  "chatjs/plugins/guest-chat/routes/create-session.ts",
  "chatjs/plugins/guest-chat/session-profile.ts",
  "chatjs/plugins/guest-chat/signed-out.tsx",
];

const guestChatItem = definePluginItem(
  {
    name: "guest-chat",
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
        path: "src/plugins/guest-chat/adapters/agent/instrumentation/guest-retention.ts",
        target: "~/agent/instrumentation/guest-retention.ts",
        type: "registry:file",
      },
      {
        path: "src/plugins/guest-chat/adapters/app/api/eve-guest/route.ts",
        target: "~/app/api/eve-guest/route.ts",
        type: "registry:file",
      },
    ],
  },
  {
    uiBase: "base",
    databaseSchemas: ["chatjs/plugins/guest-chat/guest-schema.ts"],
    sessionAuthenticator: "chatjs-disposable-guest",
  }
);
const guestChatDefinition = guestChatItem.meta.chatjs;
export { guestChatItem, guestChatDefinition, guestChatFiles };
