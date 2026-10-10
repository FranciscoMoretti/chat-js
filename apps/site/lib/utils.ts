import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

type ReadonlyClassValue =
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined
  | Readonly<Record<string, unknown>>
  | readonly ReadonlyClassValue[];

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (cn); the enabled import/no-default-export convention rejects the default-export alternative. */
export const cn = (...inputs: readonly ReadonlyClassValue[]): string =>
  twMerge(clsx(inputs));
/* oxlint-enable import/prefer-default-export, import/no-named-export */
