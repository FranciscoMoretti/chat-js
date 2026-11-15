import { CapabilityVisual } from "./capability-visual";
import { ArrowUpRight, Info } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/vendor/shadcn-create/styles/base-nova/ui/button";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/vendor/shadcn-create/styles/base-nova/ui/popover";
import { Checkbox } from "@/vendor/shadcn-create/styles/base-nova/ui/checkbox";

export const CapabilityRow = ({
  title,
  badge,
  visualId,
  category,
  description,
  source,
  requiresChatJS,
  controlId,
  controlLabel = title,
  checked,
  disabled,
  onCheckedChange,
  control,
  docs,
  reason,
  details,
  testId,
}: {
  readonly title: string;
  readonly badge?: string;
  readonly visualId: string;
  readonly category?: string;
  readonly description: string;
  readonly source: string;
  readonly requiresChatJS?: boolean;
  readonly controlId: string;
  readonly controlLabel?: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly control?: ReactNode;
  readonly onCheckedChange?: (checked: boolean) => void;
  readonly docs?: string;
  readonly reason?: string;
  readonly details?: ReactNode;
  readonly testId?: string;
}) => (
  <article
    data-testid={testId}
    data-selected={checked}
    data-disabled={disabled}
    className="bg-card hover:border-foreground/40 data-[selected=true]:border-foreground has-[:focus-visible]:outline-ring relative flex min-w-0 rounded-md border has-[:focus-visible]:outline-2"
  >
    <label
      htmlFor={controlId}
      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 rounded-md py-4 ps-4 pe-11 [-webkit-tap-highlight-color:transparent] has-[:disabled]:cursor-default motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:not-has-[:disabled]:active:scale-[0.96]"
    >
      <CapabilityVisual id={visualId} category={category} />
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-5 font-medium break-words">
          {title}
          {badge !== undefined && (
            <span className="bg-muted text-muted-foreground ms-2 inline-flex rounded px-1.5 py-0.5 align-middle text-[10px] leading-4 font-medium">
              {badge}
            </span>
          )}
        </span>
        <span className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5">
          {description}
        </span>
        {reason !== undefined && (
          <span className="text-muted-foreground mt-1 block text-xs leading-5">
            {reason}
          </span>
        )}
      </span>
      {control ?? (
        <Checkbox
          id={controlId}
          className="absolute! end-3 top-4 shrink-0"
          aria-label={controlLabel}
          checked={checked}
          disabled={disabled}
          onCheckedChange={onCheckedChange}
        />
      )}
    </label>
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground absolute end-1.5 bottom-1.5 size-7"
          />
        }
        aria-label={`About ${title}`}
      >
        <Info className="size-3.5" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 max-w-[calc(100vw-2rem)] motion-reduce:animate-none!"
      >
        <PopoverHeader>
          <PopoverTitle>{title}</PopoverTitle>
          <PopoverDescription>{description}</PopoverDescription>
        </PopoverHeader>
        <div className="text-muted-foreground space-y-1 text-xs">
          <p aria-label={`Source: ${source}`}>Source: {source}</p>
          {requiresChatJS === true && <p>Requires ChatJS</p>}
          {reason !== undefined && <p>{reason}</p>}
          {details}
        </div>
        {docs !== undefined && (
          <a
            href={docs}
            target="_blank"
            rel="noreferrer"
            aria-label={`${title} documentation`}
            className="focus-visible:outline-ring inline-flex items-center gap-1 text-xs underline underline-offset-4 focus-visible:outline-2"
          >
            Documentation
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </a>
        )}
      </PopoverContent>
    </Popover>
  </article>
);
