/** Approved seven-square C. Keep the empty center and right opening. */
export const mark = {
  viewBox: "0 0 30 30",
  path: "M1 1h8v8H1zm10 0h8v8h-8zm10 0h8v8h-8zM1 11h8v8H1zm0 10h8v8H1zm10 0h8v8h-8zm10 0h8v8h-8z",
} as const;

export const colors = {
  background: "#0b0b0a",
  surface: "#121211",
  shade: "#111110",
  foreground: "#e8e8df",
  muted: "#acac9f",
  pattern: "#b6b6aa",
  border: "#404039",
} as const;

export const foundations = [
  { id: "chat", name: "Chat", meta: "Included" },
  { id: "runtime", name: "Runtime", meta: "Included" },
  { id: "auth", name: "Auth", meta: "Included" },
  { id: "gateway", name: "Gateway", meta: "Choose" },
  { id: "tools", name: "Tools", meta: "Optional" },
  { id: "plugins", name: "Plugins", meta: "Optional" },
  { id: "storage", name: "Storage", meta: "As needed" },
] as const;

export const markSvg = (fill = "currentColor") =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${mark.viewBox}" fill="${fill.replaceAll("&", "&amp;").replaceAll('"', "&quot;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}"><path d="${mark.path}"/></svg>`;
