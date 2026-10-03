"use client";
/* oxlint-disable import/no-namespace -- @radix-ui/react-collapsible import: import/no-namespace: the React or primitive namespace carries the library component and type contract. */

import * as CollapsiblePrimitive from "@radix-ui/react-collapsible";
/* oxlint-enable import/no-namespace */

const {
  Root: Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} = CollapsiblePrimitive;
/* oxlint-disable import/no-named-export -- collapsible.tsx exports: import/no-named-export: existing callers import this public component, type, or hook by name. */

export { Collapsible, CollapsibleContent, CollapsibleTrigger };
/* oxlint-enable import/no-named-export */
