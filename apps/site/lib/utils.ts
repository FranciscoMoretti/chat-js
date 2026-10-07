import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (cn); the enabled import/no-default-export convention rejects the default-export alternative. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- cn: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable typescript/prefer-readonly-parameter-types */
