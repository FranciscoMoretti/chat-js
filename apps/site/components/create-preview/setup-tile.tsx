import type { ReactNode } from "react";
import {
  Field,
  FieldLabel,
  FieldTitle,
} from "@/vendor/shadcn-create/styles/base-nova/ui/field";

export const setupTileGrid =
  "grid grid-cols-[repeat(auto-fill,minmax(min(100%,8rem),1fr))] gap-3";
export const setupTileControl =
  "absolute! end-2.5 top-2.5 size-4! max-w-4! min-w-4!";

export const SetupTile = ({
  title,
  caption,
  controlId,
  control,
  visual,
  action,
}: {
  readonly title: string;
  readonly caption: string;
  readonly controlId: string;
  readonly control: ReactNode;
  readonly visual: ReactNode;
  readonly action?: ReactNode;
}) => (
  <div className="relative min-w-0">
    <FieldLabel
      htmlFor={controlId}
      className="bg-card has-data-checked:border-foreground! has-data-checked:bg-card! hover:border-foreground/40 aspect-square min-w-0 cursor-pointer rounded-md! [-webkit-tap-highlight-color:transparent] motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:not-has-[:disabled]:active:scale-[0.96]"
    >
      <Field className="relative h-full min-w-0 items-center gap-2 p-3!">
        {control}
        <div className="flex min-h-9 flex-1 items-center justify-center">
          {visual}
        </div>
        <div className="w-full min-w-0 space-y-1 text-center">
          <FieldTitle className="min-h-10 w-full max-w-full min-w-0 items-center justify-center text-sm leading-5 break-words">
            {title}
          </FieldTitle>
          <p className="text-muted-foreground text-[11px] leading-4 font-normal">
            {caption}
          </p>
        </div>
      </Field>
    </FieldLabel>
    {action}
  </div>
);
