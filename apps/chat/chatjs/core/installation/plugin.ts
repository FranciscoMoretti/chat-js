import type {
  InstalledRouters,
  InstrumentationRegistration,
} from "@/chatjs/core/installation/contracts";

/** Server contributions stay out of the client configuration graph. */
interface ChatPlugin {
  readonly id: string;
  readonly routers?: InstalledRouters;
  readonly instrumentation?: InstrumentationRegistration;
}

export type { ChatPlugin };
