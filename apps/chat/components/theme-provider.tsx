"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import React from "react";

/* oxlint-disable no-magic-numbers -- NextProviderProps: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0). */

type NextProviderProps = Parameters<typeof NextThemesProvider>[0];
/* oxlint-enable no-magic-numbers */
/* oxlint-disable import/no-named-export, import/prefer-default-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- ThemeProvider: import/no-named-export: existing callers import this public component, type, or hook by name; import/prefer-default-export: the existing named import remains stable when this module adds another public declaration; oxc/no-rest-spread-properties: compose immutable state or forward the remaining typed props without mutating the caller object; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, ...props }: NextProviderProps). */

export const ThemeProvider = ({
  children,
  ...props
}: NextProviderProps): React.JSX.Element => (
  <NextThemesProvider {...props}>{children}</NextThemesProvider>
);
/* oxlint-enable import/no-named-export, import/prefer-default-export, oxc/no-rest-spread-properties, react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
