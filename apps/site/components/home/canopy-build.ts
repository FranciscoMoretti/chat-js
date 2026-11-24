import { serializeAppPreset } from "../../../../packages/registry/app-preset-wire";
import type { canopyBuildDefaults } from "./canopy-catalog";

type Defaults = typeof canopyBuildDefaults;

const appTools = new Set([
  "attach-workspace-file",
  "deep-research",
  "generate-image",
  "generate-video",
]);

export const initialCanopySelection = (defaults: Defaults): Set<string> =>
  new Set([
    ...defaults.tools,
    "projects",
    "attachment-uploads",
    "image-viewer",
    "search",
    "ai-titles",
    "memory/file",
  ]);

export const toggleCanopyBlock = (
  selected: ReadonlySet<string>,
  id: string
) => {
  const next = new Set(selected);
  if (!next.delete(id)) {
    next.add(id);
  }
  return next;
};

export const canopyCreateHref = (
  selected: ReadonlySet<string>,
  defaults: Defaults
): string => {
  const ids = [...selected];
  const builtInTools = new Set<string>(defaults.tools);
  const disabledDefaultTools = defaults.tools.filter((id) => !selected.has(id));
  const app = serializeAppPreset({
    agent: { ...defaults.agent, disabledDefaultTools },
    eve: ids.filter((id) => id.includes("/") && !builtInTools.has(id)),
    ...defaults.installation,
    plugins: ids.filter((id) => !id.includes("/") && !appTools.has(id)),
    tools: ids.filter((id) => appTools.has(id)),
  });
  return `/create?${new URLSearchParams({ app })}`;
};
