import { bindComposer, createView, defineServices } from "./scope";

const services = defineServices({
	models: ["fast", "careful"],
	defaultModel: "fast",
	send: async (request) => ({
		messageId: request.parentMessageId,
		executionId: "run",
	}),
	stop: async () => {},
	approve: async () => {},
});
const submit = bindComposer(createView("c", "left", "root"), services);
void submit("careful");
// @ts-expect-error unavailable model must remain a compile-time failure
void submit("invented");
defineServices({
	models: ["fast"],
	// @ts-expect-error default cannot widen the selected catalog
	defaultModel: "invented",
	send: services.send,
	stop: services.stop,
	approve: services.approve,
});
