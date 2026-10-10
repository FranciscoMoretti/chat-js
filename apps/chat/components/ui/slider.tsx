"use client";

import type {
  ComponentProps as ReactComponentProps,
  JSX as ReactJSX,
} from "react";
import {
  Range as SliderPrimitiveRange,
  Root as SliderPrimitiveRoot,
  Thumb as SliderPrimitiveThumb,
  Track as SliderPrimitiveTrack,
} from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";
import { useMemo as useReactMemo } from "react";

const DEFAULT_SLIDER_MIN = 0;
const DEFAULT_SLIDER_MAX = 100;

/* oxlint-disable max-lines-per-function -- Slider keeps the controlled/default value selection and matching thumb rendering together. */

/* oxlint-disable react/react-in-jsx-scope -- Slider uses the configured react-jsx automatic runtime, which imports JSX helpers without a React value binding. */
const Slider = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    className,
    defaultValue,
    value,
    min = DEFAULT_SLIDER_MIN,
    max = DEFAULT_SLIDER_MAX,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes className, defaultValue, value, min, max from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: ReactComponentProps<typeof SliderPrimitiveRoot>
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): ReactJSX.Element => {
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
        (unusedValue, index): ReactJSX.Element => (
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
/* oxlint-enable max-lines-per-function */

export { Slider };
/* oxlint-enable import/prefer-default-export, import/no-named-export */
