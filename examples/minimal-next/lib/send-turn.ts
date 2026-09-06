/** A previous cancellation may settle the response before the new turn is read.
 * Catch up only for the next command after cancellation, using public replay. */
export async function sendTurn(
	send: () => Promise<void>,
	resume: () => Promise<void>,
	afterCancellation = false,
): Promise<void> {
	await send();
	if (afterCancellation) await resume();
}
