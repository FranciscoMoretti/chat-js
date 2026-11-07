// Host capabilities, separate from what can be installed. Keep this serializable
// so the configurator never imports production plugin controllers.
export const livePreviewPlugins = [
  "feedback",
  "projects",
  "credits",
  "search",
  "model-preferences",
  "attachment-uploads",
] as const;

export const pluginPreviewLabel = (id: string, hasClient: boolean) => {
  if (id === "attachment-uploads" || id === "model-preferences") {
    return "Sample preview";
  }
  if (livePreviewPlugins.some((plugin) => plugin === id)) {
    return "Live preview";
  }
  if (id === "vercel-analytics" || id === "vercel-speed-insights") {
    return "No visible UI";
  }
  return hasClient ? "Not previewed" : "Server only";
};
