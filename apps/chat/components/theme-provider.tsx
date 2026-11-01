"use client";

import type { ComponentProps } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import React from "react";

type NextProviderProps = ComponentProps<typeof NextThemesProvider>;

export const ThemeProvider = ({
  children,
  ...props
}: NextProviderProps): React.JSX.Element => (
  <NextThemesProvider {...props}>{children}</NextThemesProvider>
);
