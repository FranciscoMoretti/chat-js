import { useMessages } from "./queries";
export function Messages() {
	const query = useMessages();
	if (query.isPending) return <p>Loading</p>;
	if (query.isError) return <p role="alert">{query.error.message}</p>;
	return (
		<ul>
			{query.data.map((message) => (
				<li key={message.id}>{message.text}</li>
			))}
		</ul>
	);
}
