import type { RegistryItem } from "shadcn/schema";
import { pluginDefinitionSchema } from "../../../metadata";

const sources = [
  "session-profile.ts",
  "slack-documents-renderer.ts",
  "slack-identity.ts",
  "slack-documents.ts",
  "slack-environment.ts",
  "slack-store.ts",
  "slack-settings.ts",
  "slack-schema.ts",
];
const files = [...sources, "SETUP.md"].map(
  (file) => `chatjs/plugins/slack-documents/${file}`
);
export const slackDocumentsItem: RegistryItem = {
  name: "slack-documents",
  title: "Slack documents",
  type: "registry:item",
  description:
    "Optional ChatJS document storage and resource isolation for Slack. Requires explicit channel configuration.",
  dependencies: ["drizzle-orm", "zod"],
  files: files.map((file) => ({
    path: `src/plugins/slack-documents/src/${file.split("/").at(-1)}`,
    target: `~/${file}`,
    type: "registry:file",
  })),
  meta: {
    chatjs: pluginDefinitionSchema.parse({
      contractVersion: 1,
      id: "slack-documents",
      kind: "plugin",
      files,
      databaseSchemas: ["chatjs/plugins/slack-documents/slack-schema.ts"],
      sessionProfile: {
        export: "slackSessionProfile",
        authenticator: "slack-webhook",
      },
      environmentValidation: "slack-environment.ts",
      envRequirements: [
        {
          options: [["CHATJS_SLACK_DOCUMENTS"]],
          description:
            "Optional Slack document workspace and participant access policy",
        },
      ],
    }),
  },
};
