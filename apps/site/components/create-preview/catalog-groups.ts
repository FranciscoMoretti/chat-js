import type { InstallationCatalogItem } from "../../../../packages/registry/installation-catalog";

const appPluginGroups = [
  {
    title: "Conversations",
    ids: ["projects", "search", "ai-titles", "sharing"],
  },
  {
    title: "Responses",
    ids: ["feedback", "followup-suggestions", "model-preferences"],
  },
  { title: "Files & connections", ids: ["attachment-uploads", "mcp"] },
  { title: "Access & usage", ids: ["guest-chat", "credits"] },
];

export const stackPluginGroups = [
  {
    id: "observability",
    title: "Observability",
    ids: ["vercel-analytics", "vercel-speed-insights", "langfuse"],
    description: "Understand traffic, app performance and AI activity.",
  },
  {
    id: "platforms",
    title: "Platforms",
    ids: ["desktop"],
    description: "Web is included. Add a desktop companion for your app.",
  },
];

const toolGroups = [
  {
    title: "Search & research",
    ids: ["tavily-search", "firecrawl-search", "retrieve-url", "deep-research"],
  },
  {
    title: "Documents",
    ids: [
      "text-documents",
      "code-documents",
      "sheet-documents",
      "read-document",
      "delete-document",
    ],
  },
  { title: "Media", ids: ["generate-image", "generate-video"] },
  { title: "Execution", ids: ["code-execution", "saved-code-execution"] },
  { title: "Utilities", ids: ["get-weather", "word-count"] },
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
  const stackIds = new Set(stackPluginGroups.flatMap(({ ids }) => ids));
  return groupChoices(
    catalog.filter(
      (item) =>
        item.definition?.kind === "plugin" && !stackIds.has(item.definition.id)
    ),
    appPluginGroups,
    "Other plugins"
  );
};

export const groupTools = (tools: readonly InstallationCatalogItem[]) =>
  groupChoices(tools, toolGroups, "Other tools");
