import postgres from "postgres";
import { required } from "./env";

export const sql = postgres(required("APP_DATABASE_URL"), { max: 5 });
export type Binding = {
	conversation_id: string;
	owner_subject: string;
	operation_id: string;
	message: string;
	session_id: string | null;
	state: "creating" | "bound" | "uncertain";
};
export async function authorizeSession(
	owner: string,
	session: string,
): Promise<boolean> {
	const rows =
		await sql`SELECT 1 FROM chatjs.conversations WHERE owner_subject = ${owner} AND session_id = ${session} AND state = 'bound'`;
	return rows.length === 1;
}
export async function createConversation(
	owner: string,
	operation: string,
	message: string,
	create: (operation: string) => Promise<string>,
): Promise<Binding> {
	// The durable reservation is committed before calling Eve. No in-memory
	// promise can be joined by a different caller, or bypass authorization.
	const id = crypto.randomUUID();
	const inserted = await sql<
		Binding[]
	>`INSERT INTO chatjs.conversations (conversation_id, owner_subject, operation_id, message) VALUES (${id}, ${owner}, ${operation}, ${message}) ON CONFLICT (owner_subject, operation_id) DO NOTHING RETURNING *`;
	if (!inserted.length) {
		const [existing] = await sql<
			Binding[]
		>`SELECT * FROM chatjs.conversations WHERE owner_subject = ${owner} AND operation_id = ${operation}`;
		if (!existing || existing.message !== message)
			throw new Conflict("Operation payload differs");
		if (existing.state !== "bound")
			throw new Conflict(
				"Creation is unresolved; do not retry with a new operation ID",
			);
		return existing;
	}
	try {
		const session = await create(id);
		const [bound] = await sql<
			Binding[]
		>`UPDATE chatjs.conversations SET session_id = ${session}, state = 'bound' WHERE conversation_id = ${id} AND owner_subject = ${owner} RETURNING *`;
		if (!bound) throw new Error("Binding was not persisted");
		return bound;
	} catch (error) {
		// An ambiguous network/database failure must never launch a second session.
		// Operator reconciliation is explicit until an atomic upstream contract exists.
		await sql`UPDATE chatjs.conversations SET state = 'uncertain' WHERE conversation_id = ${id} AND state = 'creating'`;
		throw error;
	}
}
export class Conflict extends Error {}
