import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import type { ModelId } from "./models";
import { useView, useViewStore } from "./view";

const messagesSchema = z.array(z.object({ id: z.string(), text: z.string() }));
const key = (conversationId: string) => ["messages", conversationId];
// Selected local integration module, not a component registry or setup object.
export function useMessages() {
	const conversationId = useView((s) => s.conversationId);
	return useQuery({
		queryKey: key(conversationId),
		staleTime: Infinity,
		queryFn: async () => {
			const response = await fetch(
				`/messages?conversation=${encodeURIComponent(conversationId)}`,
			);
			if (!response.ok) throw new Error("Unable to load messages");
			return messagesSchema.parse(await response.json());
		},
	});
}
export function useSubmit() {
	const store = useViewStore();
	const query = useQueryClient();
	return useMutation({
		mutationFn: async (input: {
			conversationId: string;
			viewId: string;
			text: string;
			model: ModelId;
		}) => {
			const response = await fetch("/send", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify(input),
			});
			if (!response.ok) throw new Error("Unable to send");
		},
		onSuccess: async (_, input) => {
			const current = store.getState();
			if (
				current.conversationId === input.conversationId &&
				current.draft === input.text
			)
				store.setState({ draft: "" });
			await query.invalidateQueries({ queryKey: key(input.conversationId) });
		},
	});
}
