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

const Slider = ({
  className,
  defaultValue,
  value,
  min = DEFAULT_SLIDER_MIN,
  max = DEFAULT_SLIDER_MAX,
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
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:opacity-50 data-[orientation=vertical]:h-full data-[orientation=vertical]:min-h-44 data-[orientation=vertical]:w-auto data-[orientation=vertical]:flex-col",
        className
      )}
      data-slot="slider"
      defaultValue={defaultValue}
      max={max}
      min={min}
      value={value}
      {...props}
    >
      <SliderPrimitiveTrack
        className={cn(
          "bg-muted relative grow overflow-hidden rounded-full data-[orientation=horizontal]:h-1.5 data-[orientation=horizontal]:w-full data-[orientation=vertical]:h-full data-[orientation=vertical]:w-1.5"
        )}
        data-slot="slider-track"
      >
        <SliderPrimitiveRange
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
            className="border-primary bg-background ring-ring/50 block size-4 shrink-0 rounded-full border shadow-sm transition-[color,box-shadow] hover:ring-4 focus-visible:ring-4 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
            data-slot="slider-thumb"
            key={index}
          />
        )
      )}
    </SliderPrimitiveRoot>
  );
};

export { Slider };
