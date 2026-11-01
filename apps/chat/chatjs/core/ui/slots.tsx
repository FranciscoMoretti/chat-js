"use client";

import { createContext, createElement, useContext, useMemo } from "react";
import type { ComponentType, ReactNode } from "react";

interface SlotBinding {
  readonly slot: object;
  readonly View: ComponentType;
}
export interface UiPlugin {
  readonly id: string;
  readonly slots: readonly SlotBinding[];
}
interface InstalledSlotBinding extends SlotBinding {
  readonly key: string;
}
const Bindings = createContext<
  ReadonlyMap<object, readonly InstalledSlotBinding[]>
>(new Map());

const bindSlot = Symbol("bindSlot");

/** Declare at module scope. The component reference is the typed slot identity. */
export const defineSlot = <Props extends object = Record<string, never>>() => {
  const identity = {};
  const SlotProps = createContext<Props | null>(null);
  const useBindings = () => {
    const installed = useContext(Bindings);
    return installed.get(identity) ?? [];
  };
  const Slot = (props: Props) => {
    const entries = useBindings();
    return (
      <SlotProps value={props}>
        {entries.map(({ View, key }) => (
          <View key={key} />
        ))}
      </SlotProps>
    );
  };
  const bind = (Component: ComponentType<Props>) => {
    const View = () => {
      const props = useContext(SlotProps);
      if (props === null) {
        throw new Error("A bound component must render inside its slot.");
      }
      return createElement(Component, props);
    };
    return { slot: identity, View } satisfies SlotBinding;
  };
  const useHasContent = () => useBindings().length > 0;
  return Object.assign(Slot, { [bindSlot]: bind, useHasContent });
};

/** Bind a component without changing the slot or rendering it. */
export const slot = <Props extends object>(
  target: {
    readonly [bindSlot]: (component: ComponentType<Props>) => SlotBinding;
  },
  component: ComponentType<NoInfer<Props>>
): SlotBinding => target[bindSlot](component);

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
    const resolved = new Map<object, InstalledSlotBinding[]>();
    const seen = new Set<string>();
    for (const plugin of plugins) {
      if (seen.has(plugin.id)) {
        throw new Error(`Duplicate UI plugin: ${plugin.id}`);
      }
      seen.add(plugin.id);
      for (const [index, binding] of plugin.slots.entries()) {
        const entries = resolved.get(binding.slot) ?? [];
        entries.push({ ...binding, key: `${plugin.id}:${index}` });
        resolved.set(binding.slot, entries);
      }
    }
    return resolved;
  }, [plugins]);
  return <Bindings value={registry}>{children}</Bindings>;
};
