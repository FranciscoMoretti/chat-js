import type { ComposerControl } from "@/components/composer/control";
import type { SettingsItem } from "@/components/settings/settings-item";
import type {
  AttachmentUploadIntegration,
  InstalledLayoutComponent,
  InstalledRouters,
  InstrumentationRegistration,
} from "./installation-contracts";

/** Server contributions stay out of the client configuration graph. */
interface ChatPlugin {
  readonly id: string;
  readonly routers?: InstalledRouters;
  readonly instrumentation?: InstrumentationRegistration;
}

/** Use satisfies to retain each plugin's inferred contributions. */
interface ChatClientPlugin {
  readonly id: string;
  readonly composerControls?: readonly ComposerControl[];
  readonly settingsItems?: readonly SettingsItem[];
  readonly layout?: InstalledLayoutComponent;
  readonly uploads?: AttachmentUploadIntegration;
}
export type { ChatPlugin, ChatClientPlugin };
