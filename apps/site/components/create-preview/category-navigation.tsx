import type { ReactNode } from "react";

export const categoryLayout =
  "grid items-start gap-6 lg:grid-cols-[10rem_minmax(0,1fr)]";

export const CategoryNavigation = ({
  label,
  prefix,
  sections,
  children,
}: {
  readonly label: string;
  readonly prefix: string;
  readonly sections: readonly {
    id: string;
    title: string;
    icon: ReactNode;
    count?: number;
  }[];
  readonly children?: ReactNode;
}) => (
  <nav
    aria-label={label}
    className="bg-background sticky top-0 z-10 flex items-center gap-2 py-2 lg:top-6 lg:block lg:space-y-1 lg:py-0"
  >
    <select
      aria-label="Jump to category"
      className="border-input bg-background h-10 min-w-0 flex-1 rounded-md border px-3 text-sm lg:hidden"
      value=""
      onChange={(event) => {
        document
          .querySelector(`#${CSS.escape(`${prefix}-${event.target.value}`)}`)
          ?.scrollIntoView({ block: "start" });
      }}
    >
      <option value="" disabled>
        Jump to category
      </option>
      {sections.map(({ id, title, count }) => (
        <option key={id} value={id}>
          {title}
          {count === undefined ? "" : ` (${count})`}
        </option>
      ))}
    </select>
    {sections.map(({ id, title, icon, count }) => (
      <a
        key={id}
        href={`#${prefix}-${id}`}
        aria-label={title}
        className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-ring hidden items-center gap-2 rounded-md px-2 py-2 text-xs font-medium focus-visible:outline-2 lg:flex"
      >
        {icon}
        {title}
        {count !== undefined && (
          <span aria-hidden="true" className="ms-auto text-[10px] tabular-nums">
            {count}
          </span>
        )}
      </a>
    ))}
    {children}
  </nav>
);
