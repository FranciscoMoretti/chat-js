"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import React from "react";

/* oxlint-disable no-magic-numbers -- NextProviderProps: no-magic-numbers: these existing UI dimensions, timing values, marker offsets, or fixture expectations are part of this feature behavior (including 0). */

type NextProviderProps = Parameters<typeof NextThemesProvider>[0];
/* oxlint-enable no-magic-numbers */
/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- ThemeProvider: ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, ...props }: NextProviderProps). */

export const ThemeProvider = ({
  children,
  ...props
}: NextProviderProps): React.JSX.Element => (
  <NextThemesProvider {...props}>{children}</NextThemesProvider>
);
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
