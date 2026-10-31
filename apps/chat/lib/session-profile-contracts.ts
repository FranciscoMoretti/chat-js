import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { z } from "zod";
import type { ReadonlyNativeSurface } from "./readonly-native-surface";

/** Identity returned by a channel authenticator and persisted by the runtime. */
export interface SessionAuthentication {
  attributes: Record<string, string>;
  authenticator: string;
  issuer: string;
  principalId: string;
  principalType: string;
  subject: string;
}

/** Model and generation settings consumed by the shared agent. */
export interface SessionModel {
  model: LanguageModelV4;
  modelContextWindowTokens: number;
  modelOptions: {
    providerOptions: Record<string, Record<string, z.output<z.ZodJSONSchema>>>;
  };
}

/** A non-account session owns its authentication, model bounds and instructions together. */
export interface SessionProfile {
  readonly authenticator: string;
  readonly authenticate: (
    request: ReadonlyNativeSurface<Request>
  ) => Promise<SessionAuthentication | null>;
  readonly resolveModel: () => Promise<SessionModel>;
  readonly instructions: string;
}
