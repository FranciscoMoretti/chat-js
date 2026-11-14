import type { ReactNode } from "react";

export const ConfigurationSection = ({
  id,
  title,
  icon,
  description,
  children,
  action,
  prefix = "setup",
}: {
  readonly prefix?: string;
  readonly id: string;
  readonly title: string;
  readonly icon?: ReactNode;
  readonly description?: string;
  readonly children: ReactNode;
  readonly action?: ReactNode;
}) => (
  <section
    id={`${prefix}-${id}`}
    aria-label={title}
    className="scroll-mt-6 border-b pb-9 last:border-0"
  >
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          {icon}
          {title}
        </h2>
        {description !== undefined && (
          <p className="text-muted-foreground mt-1 text-sm leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
    {children}
  </section>
);
