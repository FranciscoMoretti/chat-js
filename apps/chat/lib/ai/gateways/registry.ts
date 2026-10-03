/* oxlint-disable import/no-relative-parent-imports  --
 * import/no-relative-parent-imports (#530): Keep the explicit "../gateway"; "../gateway-model-defaults"; "../models.generated" dependency within this package instead of introducing an alias or barrel API.
 * sort-imports (#521): Oxfmt owns the case-insensitive import groups in this section; ESLint declaration ordering would be undone by the required formatter.
 */
import type { GatewayProvider as GatewayProviderBase } from "@chat-js/gateways/gateway-provider";

import type { Gateway } from "../gateway";
import type { gatewayType } from "../gateway-model-defaults";
import type { generatedForGateway, models } from "../models.generated";
/* oxlint-enable import/no-relative-parent-imports */

/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): InstalledGateway is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): InstalledGateway stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named InstalledGateway API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type InstalledGateway = InstanceType<typeof Gateway>;
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable import/exports-last, import/group-exports  --
 * import/exports-last (#522): GatewayType is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): GatewayType stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named GatewayType API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 */
export type GatewayType = typeof gatewayType;
/* oxlint-enable import/exports-last, import/group-exports */
/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers  --
 * import/exports-last (#522): GatewayProvider is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): GatewayProvider stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named GatewayProvider API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): GatewayProvider uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export type GatewayProvider = GatewayProviderBase<
  GatewayType,
  Parameters<InstalledGateway["createLanguageModel"]>[0],
  Parameters<InstalledGateway["createImageModel"]>[0],
  Parameters<InstalledGateway["createVideoModel"]>[0]
>;
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers */

/* oxlint-disable import/exports-last, import/group-exports, no-magic-numbers  --
 * import/exports-last (#522): GatewayModelIdMap is directly exported at its declaration; moving it below executable initialization can obscure ordering and API ownership.
 * import/group-exports (#523): GatewayModelIdMap stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named GatewayModelIdMap API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): GatewayModelIdMap uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export type GatewayModelIdMap = Record<
  GatewayType,
  Parameters<InstalledGateway["createLanguageModel"]>[0]
>;
/* oxlint-enable import/exports-last, import/group-exports, no-magic-numbers */

/* oxlint-disable id-length --
 * id-length (#506): TupleIncludes uses T; E; H; R as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
// Helper: check if tuple T contains element E
type TupleIncludes<T extends readonly unknown[], E> = T extends readonly [
  infer H,
  ...infer R,
]
  ? H extends E
    ? true
    : TupleIncludes<R, E>
  : false;
/* oxlint-enable id-length */

/* oxlint-disable id-length --
 * id-length (#506): MultimodalImageModel uses M as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 */
// Extract language models with "image-generation" tag from the snapshot
type MultimodalImageModel =
  Extract<
    (typeof models)[number],
    { type: "language"; tags: readonly string[] }
  > extends infer M
    ? M extends { id: infer Id; tags: infer Tags extends readonly string[] }
      ? TupleIncludes<Tags, "image-generation"> extends true
        ? Id
        : never
      : never
    : never;
/* oxlint-enable id-length */

/* oxlint-disable id-length, import/group-exports, no-magic-numbers  --
 * id-length (#506): GatewayImageModelIdMap uses K as local notation or callback/type parameters; a length-only rename does not establish clearer domain terminology.
 * import/group-exports (#523): GatewayImageModelIdMap stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named GatewayImageModelIdMap API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): GatewayImageModelIdMap uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export type GatewayImageModelIdMap = {
  [K in GatewayType]:
    | Parameters<InstalledGateway["createImageModel"]>[0]
    | (K extends typeof generatedForGateway ? MultimodalImageModel : never);
};
/* oxlint-enable id-length, import/group-exports, no-magic-numbers */

/* oxlint-disable import/group-exports, no-magic-numbers  --
 * import/group-exports (#523): GatewayVideoModelIdMap stays exported at its declaration so its public contract is visible beside its implementation.
 * import/no-named-export (#527): Preserve the named GatewayVideoModelIdMap API used by direct imports; the simultaneously enabled no-default-export rule forbids converting it to a default.
 * no-magic-numbers (#517): GatewayVideoModelIdMap uses 0 in its existing protocol/math/layout contract; naming and changing those domain constants requires separate semantic decisions.
 */
export type GatewayVideoModelIdMap = Record<
  GatewayType,
  Parameters<InstalledGateway["createVideoModel"]>[0]
>;
/* oxlint-enable import/group-exports, no-magic-numbers */
