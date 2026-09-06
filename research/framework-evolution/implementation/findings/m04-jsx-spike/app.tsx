import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Composer } from "./composer";
import { ExternalComposer } from "./external-composer";
import { Messages } from "./messages";
import { ModelPicker } from "./model-picker";
import { ConversationView } from "./view";

const query = new QueryClient({
	defaultOptions: { queries: { retry: false } },
});
function Example() {
	const [picker, setPicker] = useState(true);
	return (
		<QueryClientProvider client={query}>
			<button type="button" onClick={() => setPicker((value) => !value)}>
				Toggle picker
			</button>
			<ConversationView id="left" conversationId="shared">
				<Messages />
				{picker && <ModelPicker />}
				<Composer />
			</ConversationView>
			<ConversationView id="right" conversationId="shared">
				<Messages />
				<Composer />
				<ExternalComposer />
			</ConversationView>
		</QueryClientProvider>
	);
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<Example />);
