import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const sourceFiles = [
  "chat.ts",
  "client-plugin.ts",
  "conversation-hook.ts",
  "creation.ts",
  "db/project-queries.ts",
  "db/project-schema.ts",
  "instructions-state.ts",
  "instructions.ts",
  "project-icons.ts",
  "router.ts",
  "routes/project-chat-page.tsx",
  "routes/project-page.tsx",
  "server-plugin.ts",
  "ui/chat-contributions.tsx",
  "ui/move-menu-item.tsx",
  "ui/delete-project-dialog.tsx",
  "ui/eve-move-project-dialog.tsx",
  "ui/eve-project-home.tsx",
  "ui/project-chat-item.tsx",
  "ui/project-config.tsx",
  "ui/project-details-dialog.tsx",
  "ui/project-history.tsx",
  "ui/project-icon-picker.tsx",
  "ui/project-icon.tsx",
  "ui/project-instructions-dialog.tsx",
  "ui/project-menu-items.tsx",
  "ui/sidebar-project-item.tsx",
  "ui/sidebar-projects.tsx",
  "use-projects.ts",
];
const adapterFiles = [
  "agent/hooks/projects.ts",
  "agent/instructions/projects.ts",
  "app/(chat)/project/[projectId]/chat/[chatId]/page.tsx",
  "app/(chat)/project/[projectId]/page.tsx",
];
const projectsFiles = [
  ...sourceFiles.map((file) => `plugins/projects/${file}`),
  ...adapterFiles,
];
const projectsDefinition = pluginDefinitionSchema.parse({
  contractVersion: 2,
  uiBase: "base",
  id: "projects",
  kind: "plugin",
  files: projectsFiles,
  databaseSchemas: ["plugins/projects/db/project-schema.ts"],
  server: { export: "projects", routers: ["project"] },
  chat: { export: "projectsChat" },
  client: { export: "projectsClient", chat: true },
});
const projectsItem: RegistryItem = {
  dependencies: [
    "@tanstack/react-query",
    "@trpc/client",
    "@trpc/server",
    "date-fns",
    "drizzle-orm",
    "lucide-react",
    "sonner",
  ],
  name: "projects",
  type: "registry:item",
  registryDependencies: [
    "alert-dialog",
    "breadcrumb",
    "button",
    "dialog",
    "dropdown-menu",
    "input",
    "label",
    "popover",
    "separator",
    "sidebar",
    "textarea",
  ],
  description: "Projects, chat organization, and shared project instructions",
  files: projectsFiles.map((file) => ({
    path: file.startsWith("plugins/projects/")
      ? `src/plugins/projects/src/${file.slice("plugins/projects/".length)}`
      : `src/plugins/projects/adapters/${file}`,
    target: `~/${file}`,
    type: "registry:file" as const,
  })),
  meta: { chatjs: projectsDefinition },
};
export { projectsItem, projectsFiles, projectsDefinition };
