import { Gateway } from "@/chatjs/providers/gateway";

export const createGateway = (
  ...options: ConstructorParameters<typeof Gateway>
) => new Gateway(...options);
