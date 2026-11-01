import { z } from "zod";

// Persisted identity is independent of currently installed editors.
export const artifactKind = z
  .string()
  .regex(/^[a-z][a-z0-9-]*$/u)
  .max(100);
export type ArtifactKind = z.infer<typeof artifactKind>;
