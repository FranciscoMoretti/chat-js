import type { DynamicModelContext } from "eve";
import type { HookContext } from "eve/hooks";
import type { SessionEvent } from "eve/client";
import type { LanguageModelV4 } from "@ai-sdk/provider";
import type { z } from "zod";
import type { ReadonlyNativeSurface } from "@/lib/readonly-native-surface";

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
  modelContextWindowTokens?: number;
  modelOptions: {
    providerOptions: Record<string, Record<string, z.output<z.ZodJSONSchema>>>;
  };
}

/** Optional application policies. Native channels and callers execute without one. */
export interface SessionProfile {
  readonly authenticator: string;
  readonly authenticate?: (
    request: ReadonlyNativeSurface<Request>
  ) => Promise<SessionAuthentication | null>;
  readonly resolveModel?: (
    context: DynamicModelContext,
    modelId?: string
  ) => Promise<SessionModel>;
  readonly toolNames?: ReadonlySet<string>;
  readonly specialists?: boolean;
  readonly observeEvent?: (
    event: SessionEvent,
    context: Readonly<{
      view: HookContext["view"];
      session: Readonly<Pick<HookContext["session"], "id" | "auth" | "parent">>;
    }>
  ) => Promise<void>;
  readonly instructions?: string;
}
