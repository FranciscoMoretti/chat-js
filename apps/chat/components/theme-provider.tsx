"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import React from "react";
import type { ComponentProps } from "react";

type NextProviderProps = ComponentProps<typeof NextThemesProvider>;

/* oxlint-disable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types -- ThemeProvider: ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including { children, ...props }: NextProviderProps). */

export const ThemeProvider = ({
  children,
  ...props
}: NextProviderProps): React.JSX.Element => (
  <NextThemesProvider {...props}>{children}</NextThemesProvider>
);
/* oxlint-enable react/jsx-props-no-spreading, typescript/prefer-readonly-parameter-types */
