import { definePluginItem } from "../define-item";

const desktopFiles = [
  "chatjs/plugins/desktop/desktop-auth-client.ts",
  "chatjs/plugins/desktop/auth-form.tsx",
  "chatjs/plugins/desktop/auth-handler.tsx",
  "chatjs/plugins/desktop/auth-server.ts",
  "chatjs/plugins/desktop/auth-ui.tsx",
  "chatjs/plugins/desktop/bridge.ts",
  "chatjs/plugins/desktop/layout-ui.ts",
  "chatjs/plugins/desktop/navigation.ts",
  "chatjs/plugins/desktop/protocol.ts",
  "chatjs/plugins/desktop/device-login-page.tsx",
  "chatjs/plugins/desktop/device-login-route.tsx",
  "chatjs/plugins/desktop/electron-auth.ts",
  "chatjs/plugins/desktop/sign-out.ts",
  "app/(auth)/device-login/page.tsx",
];

const desktopItem = definePluginItem(
  {
    name: "desktop",
    description:
      "Electron authentication, browser handoff and renderer integration",
    dependencies: [
      "@better-auth/electron@1.6.2",
      "better-auth@1.6.2",
      "lucide-react",
      "sonner",
    ],
    files: desktopFiles.map((file) => ({
      path: file.startsWith("chatjs/plugins/desktop/")
        ? `src/plugins/desktop/src/${file.slice("chatjs/plugins/desktop/".length)}`
        : `src/plugins/desktop/adapters/${file}`,
      target: `~/${file}`,
      type: "registry:file" as const,
    })),
  },
  {
    uiBase: "base",
  }
);
const desktopDefinition = desktopItem.meta.chatjs;
export { desktopItem, desktopDefinition, desktopFiles };
