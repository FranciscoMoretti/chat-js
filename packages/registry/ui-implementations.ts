// Explicit feature boundaries. The unsuffixed file is the reference app's native
// Base implementation; selection replaces its content at the identical target.
// These are source addresses, never heuristics for translating behavior.
export const uiImplementations = [
  {
    target: "components/editable-bubble.tsx",
    source: "apps/chat/components/editable-bubble.tsx",
    radix: "apps/chat/components/editable-bubble.radix.tsx",
  },
  {
    target: "components/ai-elements/context-hover.tsx",
    source: "apps/chat/components/ai-elements/context-hover.tsx",
    radix: "apps/chat/components/ai-elements/context-hover.radix.tsx",
  },
  {
    target: "components/composer/tool-menu-item.tsx",
    source: "apps/chat/components/composer/tool-menu-item.tsx",
    radix: "apps/chat/components/composer/tool-menu-item.radix.tsx",
  },
  {
    target: "plugins/search/search-surface.tsx",
    source: "packages/registry/src/plugins/search/src/search-surface.tsx",
    radix: "packages/registry/src/plugins/search/src/search-surface.radix.tsx",
  },
  {
    target: "plugins/sharing/ui/share-menu-surface.tsx",
    source:
      "packages/registry/src/plugins/sharing/src/ui/share-menu-surface.tsx",
    radix:
      "packages/registry/src/plugins/sharing/src/ui/share-menu-surface.radix.tsx",
  },
  {
    target: "plugins/projects/ui/move-menu-item.tsx",
    source: "packages/registry/src/plugins/projects/src/ui/move-menu-item.tsx",
    radix:
      "packages/registry/src/plugins/projects/src/ui/move-menu-item.radix.tsx",
  },
  {
    target: "plugins/mcp/connector-menu-item.tsx",
    source: "packages/registry/src/plugins/mcp/src/connector-menu-item.tsx",
    radix:
      "packages/registry/src/plugins/mcp/src/connector-menu-item.radix.tsx",
  },
  {
    target: "components/hint.tsx",
    source: "apps/chat/components/hint.tsx",
    radix: "apps/chat/components/hint.radix.tsx",
  },
  {
    target: "components/menu-button.tsx",
    source: "apps/chat/components/menu-button.tsx",
    radix: "apps/chat/components/menu-button.radix.tsx",
  },
  {
    target: "components/popover-button.tsx",
    source: "apps/chat/components/popover-button.tsx",
    radix: "apps/chat/components/popover-button.radix.tsx",
  },
  {
    target: "components/disclosure-button.tsx",
    source: "apps/chat/components/disclosure-button.tsx",
    radix: "apps/chat/components/disclosure-button.radix.tsx",
  },
  {
    target: "components/drawer-close-button.tsx",
    source: "apps/chat/components/drawer-close-button.tsx",
    radix: "apps/chat/components/drawer-close-button.radix.tsx",
  },
  {
    target: "components/dialog-button.tsx",
    source: "apps/chat/components/dialog-button.tsx",
    radix: "apps/chat/components/dialog-button.radix.tsx",
  },
  {
    target: "components/navigation-links.tsx",
    source: "apps/chat/components/navigation-links.tsx",
    radix: "apps/chat/components/navigation-links.radix.tsx",
  },
  {
    target: "components/sidebar-menus.tsx",
    source: "apps/chat/components/sidebar-menus.tsx",
    radix: "apps/chat/components/sidebar-menus.radix.tsx",
  },
  {
    target: "components/model-selection-indicator.tsx",
    source: "apps/chat/components/model-selection-indicator.tsx",
    radix: "apps/chat/components/model-selection-indicator.radix.tsx",
  },
  {
    target: "components/attachment-preview-trigger.tsx",
    source: "apps/chat/components/attachment-preview-trigger.tsx",
    radix: "apps/chat/components/attachment-preview-trigger.radix.tsx",
  },
  {
    target: "providers/ui-direction.tsx",
    source: "apps/chat/providers/ui-direction.tsx",
    radix: "apps/chat/providers/ui-direction.radix.tsx",
  },
  {
    target: "plugins/mcp/ui/transport-select.tsx",
    source: "packages/registry/src/plugins/mcp/src/ui/transport-select.tsx",
    radix:
      "packages/registry/src/plugins/mcp/src/ui/transport-select.radix.tsx",
  },
] as const;

export type UiImplementation = (typeof uiImplementations)[number];

/** Resolve the complete batch before callers publish any source. Both variants
 * must exist even when building Base, so an incomplete pair cannot be shipped. */
export const selectUiSources = async (
  sources: ReadonlyMap<string, string>,
  base: "base" | "radix",
  readRadix: (implementation: UiImplementation) => Promise<string>
): Promise<Map<string, string>> =>
  new Map(
    await Promise.all(
      [...sources].map(async ([target, source]) => {
        const implementation = uiImplementations.find(
          (entry) => entry.target === target
        );
        if (!implementation) {
          return [target, source] as const;
        }
        let radix: string;
        try {
          radix = await readRadix(implementation);
        } catch (error) {
          throw new Error(
            `Missing native Radix implementation for ${target}: ${implementation.radix}`,
            { cause: error }
          );
        }
        if (!source.trim() || !radix.trim()) {
          throw new Error(`Empty native implementation for ${target}`);
        }
        // Native source is already authored against its selected shadcn API.
        return [target, base === "base" ? source : radix] as const;
      })
    )
  );
