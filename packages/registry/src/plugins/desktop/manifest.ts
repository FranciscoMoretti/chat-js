import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const desktopFiles = [
  "plugins/desktop/desktop-auth-client.ts",
  "plugins/desktop/auth-form.tsx",
  "plugins/desktop/auth-handler.tsx",
  "plugins/desktop/auth-server.ts",
  "plugins/desktop/auth-ui.tsx",
  "plugins/desktop/bridge.ts",
  "plugins/desktop/client-plugin.ts",
  "plugins/desktop/navigation.ts",
  "plugins/desktop/protocol.ts",
  "plugins/desktop/device-login-page.tsx",
  "plugins/desktop/device-login-route.tsx",
  "plugins/desktop/electron-auth.ts",
  "plugins/desktop/sign-out.ts",
  "app/(auth)/device-login/page.tsx",
];
const desktopDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "desktop",
  kind: "plugin",
  files: desktopFiles,
  authentication: { export: "desktopAuth" },
  navigation: { export: "desktopNavigation" },
  authenticationUi: { form: "DesktopAuthForm", signOut: "signOutDesktop" },
  client: {
    export: "desktopClient",
    layout: true,
  },
});
const desktopItem: RegistryItem = {
  name: "desktop",
  type: "registry:item",
  description:
    "Electron authentication, browser handoff and renderer integration",
  dependencies: [
    "@better-auth/electron@1.6.2",
    "better-auth@1.6.2",
    "lucide-react",
    "sonner",
  ],
  files: desktopFiles.map((file) => ({
    path: file.startsWith("plugins/desktop/")
      ? `src/plugins/desktop/src/${file.slice("plugins/desktop/".length)}`
      : `src/plugins/desktop/adapters/${file}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: desktopDefinition },
};
export { desktopItem, desktopDefinition, desktopFiles };
