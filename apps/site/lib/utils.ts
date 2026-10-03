import { clsx } from "clsx";
/* oxlint-disable eslint/sort-imports -- the clsx import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import type { ClassValue } from "clsx";
/* oxlint-enable eslint/sort-imports */
import { twMerge } from "tailwind-merge";

/* oxlint-disable import/prefer-default-export -- cn: Consumers use this named API so adding another export will not require changing existing imports. */
/* oxlint-disable import/no-named-export -- cn: Existing consumers import this named API; changing its export form is an incompatible module contract change. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- cn: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable import/no-named-export */
/* oxlint-enable import/prefer-default-export */
