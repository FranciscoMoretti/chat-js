"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useSidebar } from "@/components/ui/sidebar";
/* oxlint-disable id-length, import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null -- KeyboardShortcuts: id-length: retain conventional event, index, and generic identifiers in this existing callback contract; import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships; typescript/prefer-readonly-parameter-types: React, query, editor, and primitive APIs provide these existing mutable prop and callback types (including e: KeyboardEvent); unicorn/no-null: null is the existing React empty-render, ref, or API/cache sentinel; undefined has a different contract. */

export const KeyboardShortcuts = () => {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();

  // Keyboard shortcut for new chat
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.shiftKey && e.key === "O" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpenMobile(false);
        globalThis.dispatchEvent(new Event("chatjs:new-chat"));
        router.push("/");
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setOpenMobile, router]);

  // This component only handles keyboard events
  return null;
};
/* oxlint-enable id-length, import/group-exports, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types, typescript/prefer-readonly-parameter-types, unicorn/no-null */

/* oxlint-disable import/group-exports, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types -- getNewChatShortcutText: import/group-exports: preserve direct declaration exports used by the existing component and hook consumers; ; react/only-export-components: consumers also import the associated type, variants, or helper from this established module API; typescript/explicit-function-return-type: preserve contextual callback and hook inference without widening this existing generic or state-dependent result; typescript/explicit-module-boundary-types: preserve the existing inferred hook or component API, including callback and generic result relationships. */

// Helper function to get platform-specific shortcut text
export const getNewChatShortcutText = () => {
  // oxlint-disable-next-line unicorn/prefer-global-this -- #572: This tests for a browser window; globalThis also exists during server rendering.
  if (typeof window === "undefined") {
    return "Ctrl+Shift+O";
  }

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  return isMac ? "Cmd+Shift+O" : "Ctrl+Shift+O";
};
/* oxlint-enable import/group-exports, react/only-export-components, typescript/explicit-function-return-type, typescript/explicit-module-boundary-types */
