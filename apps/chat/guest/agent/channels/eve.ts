/* oxlint-disable import/no-relative-parent-imports --
 * import/no-relative-parent-imports (#530): Keep the explicit "../../../lib/eve/disposable-guest-auth" dependency within this package instead of introducing an alias or barrel API.
 */
import { eveChannel } from "eve/channels/eve";

/* oxlint-disable sort-imports -- Preserve runtime module evaluation order; sort-imports requires different local-binding order. */
import { authenticateDisposableGuest } from "../../../lib/eve/disposable-guest-auth";
/* oxlint-enable sort-imports */
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/no-default-export --
 * import/no-default-export (#526): Preserve the existing default export import contract; converting its consumers requires a public module API migration.
 */
export default eveChannel({ auth: authenticateDisposableGuest });
/* oxlint-enable import/no-default-export */
