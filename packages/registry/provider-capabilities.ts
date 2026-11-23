export type MediaKind = "image" | "video";
export interface MediaGateway {
  readonly capabilities: Readonly<Record<MediaKind, boolean>>;
  readonly defaults: {
    readonly roles: Readonly<Partial<Record<MediaKind, string>>>;
  };
}

export const supportsMedia = (
  gateway: MediaGateway,
  kind: MediaKind
): boolean =>
  gateway.capabilities[kind] &&
  (gateway.defaults.roles[kind]?.trim() ?? "") !== "";

export const hasPersistentStorage = (id: string | undefined): boolean =>
  id !== undefined && id !== "" && id !== "memory";

export const supportsNativeProcesses = (runtimes: readonly string[]): boolean =>
  runtimes.includes("python") && runtimes.includes("javascript");
