import type { UIMessage } from "ai";

export function getMessageText(message: UIMessage) {
	return message.parts
		.map((part) => (part.type === "text" ? part.text : ""))
		.join("");
}
