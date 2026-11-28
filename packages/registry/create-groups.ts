import { isPickerPlugin } from "./installation";
import { createCatalog } from "./create-catalog";
import type { InstallationCatalogItem } from "./installation-catalog";

export const appPluginGroups = [
  {
    title: "Conversations",
    ids: ["projects", "search", "ai-titles", "sharing"],
  },
  {
    title: "Responses",
    ids: [
      "feedback",
      "followup-suggestions",
      "model-preferences",
      "streamdown-math",
      "streamdown-mermaid",
    ],
  },
  {
    title: "Files & connections",
    ids: [
      "attachment-uploads",
      "image-viewer",
      "video-viewer",
      "spreadsheet-viewer",
      "mcp",
    ],
  },
  { title: "Access & usage", ids: ["guest-chat", "credits"] },
];

export const setupPluginGroups = [
  {
    id: createCatalog.electron.menu.value,
    title: createCatalog.electron.menu.label,
    ids: [createCatalog.electron.pluginId],
    description: "Web is included. Add a desktop companion for your app.",
  },
];

interface ChoiceGroup {
  readonly title: string;
  readonly ids: readonly string[];
}

export const choicesInGroup = (
  items: readonly InstallationCatalogItem[],
  ids: readonly string[]
) => ids.flatMap((id) => items.filter((item) => item.definition?.id === id));

const groupChoices = (
  items: readonly InstallationCatalogItem[],
  groups: readonly ChoiceGroup[],
  otherTitle: string
) => {
  const knownIds = new Set(groups.flatMap(({ ids }) => ids));
  return [
    ...groups.map(({ title, ids }) => ({
      title,
      items: choicesInGroup(items, ids),
    })),
    {
      title: otherTitle,
      items: items.filter((item) => !knownIds.has(item.definition?.id ?? "")),
    },
  ].filter((group) => group.items.length > 0);
};

export const groupAppPlugins = (
  catalog: readonly InstallationCatalogItem[]
) => {
  const setupIds = new Set<string>(setupPluginGroups.flatMap(({ ids }) => ids));
  return groupChoices(
    catalog.filter(
      (item) =>
        item.definition?.kind === "plugin" &&
        !isPickerPlugin(item.definition.id) &&
        !setupIds.has(item.definition.id)
    ),
    appPluginGroups,
    "Other plugins"
  );
};
