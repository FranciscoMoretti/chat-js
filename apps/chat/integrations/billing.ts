import { installedBilling } from "@/composition/generated/installed-billing";
import { composeBilling } from "@/lib/compose-billing";

// App-owned: select or wrap billing policy here. Sync preserves this file.
export const billing = composeBilling(installedBilling);
