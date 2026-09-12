import { config } from "dotenv";
import { vi } from "vitest";

config({
  path: ".env.local",
});

// Mock the server-only module in the evaluation runtime.
vi.mock("server-only", () => ({}));
