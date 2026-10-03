import { clsx } from "clsx";
import type { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/* oxlint-disable typescript/prefer-readonly-parameter-types -- cn: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
/* oxlint-enable typescript/prefer-readonly-parameter-types */
