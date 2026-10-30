import { Gateway } from "@/lib/ai/gateway";

export const createGateway = (
  ...options: ConstructorParameters<typeof Gateway>
) => new Gateway(...options);
