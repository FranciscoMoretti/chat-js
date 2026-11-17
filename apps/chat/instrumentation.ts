import { instrumentation } from "@/integrations/instrumentation";

export const register = async (): Promise<void> => {
  // Start every installed registration even if another one fails.
  await Promise.all(
    instrumentation.map(async (registration) => {
      await registration();
    })
  );
};
