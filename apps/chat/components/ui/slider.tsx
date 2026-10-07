"use client";

import {
  Range as SliderPrimitiveRange,
  Root as SliderPrimitiveRoot,
  Thumb as SliderPrimitiveThumb,
  Track as SliderPrimitiveTrack,
} from "@radix-ui/react-slider";
import { useMemo as useReactMemo } from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
/* oxlint-enable sort-imports */

import { cn } from "@/lib/utils";
/* oxlint-disable id-length, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types -- Slider: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; max-lines-per-function: keep this cohesive render, state lifecycle, or integration scenario together; extraction needs a separate ownership decision; no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0); typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types. */

/* oxlint-disable react/react-in-jsx-scope -- Slider uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Slider = ({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, defaultValue, value, min, max from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
  ...props
}: ReactComponentProps<typeof SliderPrimitiveRoot>): ReactJSX.Element => {
  const sliderValues = useReactMemo(() => {
    if (Array.isArray(value)) {
      return value;
    }
    if (Array.isArray(defaultValue)) {
      return defaultValue;
    }
    return [min, max];
  }, [value, defaultValue, min, max]);

  return (
    <SliderPrimitiveRoot
      // oxlint-disable-next-line react/forbid-component-props -- SliderPrimitiveRoot accepts className in its styling contract; preserve this caller's layout and appearance.
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      value={value}
      // oxlint-disable-next-line react/jsx-props-no-spreading -- Forward Slider's SliderPrimitiveRoot prop contract, preserving caller options, children and callbacks.
      {...props}
    >
      <SliderPrimitiveTrack
        // oxlint-disable-next-line react/forbid-component-props -- SliderPrimitiveTrack accepts className in its styling contract; preserve this caller's layout and appearance.
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
        data-slot="slider-track"
      >
        <SliderPrimitiveRange
          // oxlint-disable-next-line react/forbid-component-props -- SliderPrimitiveRange accepts className in its styling contract; preserve this caller's layout and appearance.
          className={cn(
            "bg-primary absolute data-[orientation=horizontal]:h-full data-[orientation=vertical]:w-full"
          )}
          data-slot="slider-range"
        />
      </SliderPrimitiveTrack>
      {Array.from(
        { length: sliderValues.length },
        (_, index): ReactJSX.Element => (
          <SliderPrimitiveThumb
            // oxlint-disable-next-line react/forbid-component-props -- SliderPrimitiveThumb accepts className in its styling contract; preserve this caller's layout and appearance.
            className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
            data-slot="slider-thumb"
            key={index}
          />
        )
      )}
    </SliderPrimitiveRoot>
  );
};
/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (Slider); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-enable react/react-in-jsx-scope */
/* oxlint-enable id-length, max-lines-per-function, no-magic-numbers, typescript/prefer-readonly-parameter-types */

export { Slider };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
