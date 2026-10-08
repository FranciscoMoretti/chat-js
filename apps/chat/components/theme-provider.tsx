"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import React from "react";
/* oxlint-disable sort-imports -- Keep separate type declarations, Oxfmt grouping and runtime module order; their combined ordering conflicts with sort-imports. */
import type { ComponentProps } from "react";
/* oxlint-enable sort-imports */

type NextProviderProps = ComponentProps<typeof NextThemesProvider>;

/* oxlint-disable import/prefer-default-export, import/no-named-export -- Keep the existing named module bindings (ThemeProvider); the enabled import/no-default-export convention rejects the default-export alternative. The app guidance also requires named exports. */
/* oxlint-disable react/jsx-props-no-spreading -- ThemeProvider: ; react/jsx-props-no-spreading: forward the typed primitive or feature props, including events and accessibility attributes */

export const ThemeProvider = (
  /* oxlint-disable typescript/prefer-readonly-parameter-types -- Forwards the original native element or primitive props, including ref/event callbacks and component constructors; their exact callable and DOM contracts remain flagged by the faithful readonly rule control. */
  {
    children,
    // oxlint-disable-next-line oxc/no-rest-spread-properties -- Rest binding props excludes children from the remaining enumerable own-key snapshot; preserve this selected-field read/exclusion order and forwarding contract.
    ...props
  }: NextProviderProps
  /* oxlint-enable typescript/prefer-readonly-parameter-types */
): React.JSX.Element => (
  <NextThemesProvider {...props}>{children}</NextThemesProvider>
);
/* oxlint-enable import/prefer-default-export, import/no-named-export */
/* oxlint-enable react/jsx-props-no-spreading */
