import { setupRenderer } from "@better-auth/electron/preload";
/* oxlint-disable eslint/sort-imports -- the electron import: Oxfmt groups and sorts by module paths; ordering by imported binding names would conflict with the formatter. */
import { contextBridge, ipcRenderer } from "electron";
/* oxlint-enable eslint/sort-imports */

// Setup @better-auth/electron renderer bridges.
// Exposes window.requestAuth(), window.onAuthenticated(), window.signOut(), etc.
setupRenderer();

/* oxlint-disable typescript/promise-function-async -- electronAPI: Keep synchronous validation/throws and the original promise identity; adding async changes those observable boundaries. */
/* oxlint-disable typescript/prefer-readonly-parameter-types -- electronAPI: The database/OS/SDK object retains its declared mutable API; deep-readonly conversion requires an ownership migration. */
// Expose additional app metadata to the renderer process.
contextBridge.exposeInMainWorld("electronAPI", {
  cancelAuthFlow: () => ipcRenderer.invoke("chatjs:cancel-auth-flow"),
  getAuthState: () => ipcRenderer.invoke("chatjs:get-auth-state"),
  isElectron: true,
  onAuthStateChanged: (onStateChange: (state: unknown) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      state: unknown
    ): void => {
      onStateChange(state);
    };

    ipcRenderer.on("chatjs:auth-state-changed", listener);
    return (): void => {
      ipcRenderer.removeListener("chatjs:auth-state-changed", listener);
    };
  },
  platform: process.platform,
  syncAuthSession: () => ipcRenderer.invoke("chatjs:sync-auth-session"),
});
/* oxlint-enable typescript/prefer-readonly-parameter-types */
/* oxlint-enable typescript/promise-function-async */
