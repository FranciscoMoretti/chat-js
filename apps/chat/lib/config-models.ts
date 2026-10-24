import type {
  GatewayImageModelIdMap,
  GatewayModelIdMap,
  GatewayType,
  GatewayVideoModelIdMap,
} from "./ai/gateways/registry";
import {
  gatewayCapabilities,
  gatewayModelDefaults,
} from "./ai/gateway-model-defaults";
import { isNonEmptyString } from "./is-non-empty-string";
import { z } from "zod";

const languageModelSchema =
  z.custom<GatewayModelIdMap[GatewayType]>(isNonEmptyString);
const imageModelSchema = z.custom<GatewayImageModelIdMap[GatewayType]>(
  (value) => gatewayCapabilities.image && isNonEmptyString(value)
);
const videoModelSchema = z.custom<GatewayVideoModelIdMap[GatewayType]>(
  (value) => gatewayCapabilities.video && isNonEmptyString(value)
);
const { roles } = gatewayModelDefaults;
const modelRoles = {
  fast: languageModelSchema.parse(roles.fast),
  balanced: languageModelSchema.parse(roles.balanced),
  smart: languageModelSchema.parse(roles.smart),
  image: imageModelSchema
    .optional()
    .parse("image" in roles ? roles.image : undefined),
  video: videoModelSchema
    .optional()
    .parse("video" in roles ? roles.video : undefined),
};
export { languageModelSchema, imageModelSchema, videoModelSchema, modelRoles };
