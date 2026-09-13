"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

type NextProviderProps = Parameters<typeof NextThemesProvider>[0];

export const ThemeProvider = ({ children, ...props }: NextProviderProps) => (
  <NextThemesProvider {...props}>{children}</NextThemesProvider>
);
