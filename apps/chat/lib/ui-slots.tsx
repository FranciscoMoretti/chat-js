"use client";

import { createContext, createElement, useContext, useMemo } from "react";
import type { ComponentType, ReactNode } from "react";

interface UiContribution {
  readonly slot: object;
  readonly View: ComponentType;
}
export interface UiPlugin {
  readonly id: string;
  readonly contributions: readonly UiContribution[];
}
interface InstalledContribution extends UiContribution {
  readonly key: string;
}
const Contributions = createContext<
  ReadonlyMap<object, readonly InstalledContribution[]>
>(new Map());

/** Declare at module scope. The component reference is the typed slot identity. */
export const defineSlot = <Props extends object = Record<string, never>>() => {
  const identity = {};
  const SlotProps = createContext<Props | null>(null);
  const useContributions = () => {
    const installed = useContext(Contributions);
    return installed.get(identity) ?? [];
  };
  const Slot = (props: Props) => {
    const entries = useContributions();
    return (
      <SlotProps value={props}>
        {entries.map(({ View, key }) => (
          <View key={key} />
        ))}
      </SlotProps>
    );
  };
  const contribute = (Component: ComponentType<Props>) => {
    const View = () => {
      const props = useContext(SlotProps);
      if (props === null) {
        throw new Error("A contribution must render inside its slot.");
      }
      return createElement(Component, props);
    };
    return { slot: identity, View } satisfies UiContribution;
  };
  const useHasContributions = () => useContributions().length > 0;
  return Object.assign(Slot, { contribute, useHasContributions });
};

export const definePlugin = <const Definition extends UiPlugin>(
  definition: Definition
): Definition => definition;

export const Plugins = ({
  plugins,
  children,
}: {
  readonly plugins: readonly UiPlugin[];
  readonly children: ReactNode;
}) => {
  const registry = useMemo(() => {
    const resolved = new Map<object, InstalledContribution[]>();
    const seen = new Set<string>();
    for (const plugin of plugins) {
      if (seen.has(plugin.id)) {
        throw new Error(`Duplicate UI plugin: ${plugin.id}`);
      }
      seen.add(plugin.id);
      for (const [index, contribution] of plugin.contributions.entries()) {
        const entries = resolved.get(contribution.slot) ?? [];
        entries.push({ ...contribution, key: `${plugin.id}:${index}` });
        resolved.set(contribution.slot, entries);
      }
    }
    return resolved;
  }, [plugins]);
  return <Contributions value={registry}>{children}</Contributions>;
};
