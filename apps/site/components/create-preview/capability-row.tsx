import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { Checkbox } from "@/vendor/shadcn-create/styles/base-nova/ui/checkbox";

export const CapabilityRow = ({
  title,
  description,
  source,
  requiresChatJS,
  controlId,
  controlLabel = title,
  checked,
  disabled,
  onCheckedChange,
  docs,
  reason,
  action,
  testId,
}: {
  readonly title: string;
  readonly description: string;
  readonly source: string;
  readonly requiresChatJS?: boolean;
  readonly controlId: string;
  readonly controlLabel?: string;
  readonly checked: boolean;
  readonly disabled?: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly docs?: string;
  readonly reason?: string;
  readonly action?: ReactNode;
  readonly testId?: string;
}) => (
  <article
    data-testid={testId}
    data-selected={checked}
    className="bg-card hover:border-foreground/25 data-[selected=true]:border-foreground/50 data-[selected=true]:bg-accent/35 relative flex min-w-0 rounded-lg border transition-colors duration-150"
  >
    <label
      htmlFor={controlId}
      className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 p-3"
    >
      <Checkbox
        id={controlId}
        className="mt-0.5 shrink-0"
        aria-label={controlLabel}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1 pe-7">
          <span className="text-sm font-medium break-words">{title}</span>
          <span
            className="text-muted-foreground text-[11px]"
            aria-label={`Source: ${source}`}
          >
            {source}
          </span>
        </span>
        <span
          className="text-muted-foreground mt-1 line-clamp-2 text-xs leading-5"
          title={description}
        >
          {description}
        </span>
        {requiresChatJS === true && (
          <span className="text-muted-foreground mt-1 block text-[11px]">
            Requires ChatJS
          </span>
        )}
        {reason !== undefined && (
          <span className="text-muted-foreground mt-1 block text-xs leading-5">
            {reason}
          </span>
        )}
      </span>
    </label>
    <div className="absolute end-2 top-2">
      {docs !== undefined && (
        <a
          href={docs}
          target="_blank"
          rel="noreferrer"
          aria-label={`${title} documentation`}
          className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-ring flex size-7 items-center justify-center rounded-md focus-visible:outline-2"
        >
          <ArrowUpRight className="size-3.5" aria-hidden="true" />
        </a>
      )}
      {action}
    </div>
  </article>
);
