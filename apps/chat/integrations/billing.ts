import { installedBilling } from "@/chatjs/generated/installed-billing";
import { composeBilling } from "@/chatjs/core/billing/compose";

// App-owned: select or wrap billing policy here. Sync preserves this file.
export const billing = composeBilling(installedBilling);
