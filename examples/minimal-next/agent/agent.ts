import { defineAgent } from "eve";
import { model } from "../chat.server";
export default defineAgent({
	model,
	reasoning: "low",
	experimental: { workflow: { world: "@workflow/world-postgres" } },
});
