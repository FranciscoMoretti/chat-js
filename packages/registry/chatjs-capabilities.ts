import type { InstallationCatalogItem } from "./installation-catalog";
import type { EveCatalogItem } from "./eve-catalog";
import registryPackage from "./package.json";

export const chatjsEveRegistry = `https://unpkg.com/@chat-js/registry@${registryPackage.version}/dist/r/eve/{name}.json`;

export const portableChatjsCapabilities = (
  catalog: readonly InstallationCatalogItem[]
): EveCatalogItem[] =>
  catalog.flatMap((item) =>
    item.definition?.kind === "tool" && item.definition.native
      ? [
          {
            id: `@chatjs/${item.name}`,
            title: item.title,
            description: item.description,
            category: item.definition.agentCategory ?? "tool",
            source: "ChatJS",
            requiresChatJS: false,
            setup: false,
            environment: item.definition.envRequirements.flatMap(
              (requirement) => requirement.options.flat()
            ),
            docs: "https://www.chatjs.dev/docs/registry",
          },
        ]
      : []
  );
