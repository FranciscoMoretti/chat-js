// Host capabilities, separate from what can be installed. Keep this serializable
// so the configurator never imports production plugin controllers.
export const livePreviewPlugins = [
  "streamdown-math",
  "streamdown-mermaid",
  "image-viewer",
  "video-viewer",
  "spreadsheet-viewer",
  "mcp",
  "sharing",
  "followup-suggestions",
  "feedback",
  "projects",
  "credits",
  "search",
  "model-preferences",
  "attachment-uploads",
] as const;

export const pluginPreviewLabel = (id: string, hasClient: boolean) => {
  if (
    id === "attachment-uploads" ||
    id === "model-preferences" ||
    id === "ai-titles"
  ) {
    return "Sample preview";
  }
  if (livePreviewPlugins.some((plugin) => plugin === id)) {
    return "Live preview";
  }
  if (id === "guest-chat") {
    return "Preview as Guest";
  }
  if (id === "desktop") {
    return "Desktop app only";
  }
  return hasClient ? "Not previewed" : "Server only";
};
