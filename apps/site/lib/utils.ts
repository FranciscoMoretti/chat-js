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

export const cn = (...inputs: readonly ReadonlyClassValue[]): string =>
  twMerge(clsx(inputs));
