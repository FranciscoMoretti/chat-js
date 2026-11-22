export default async function registerGuestChat(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startLocalEveGuestCleanup } = await import("./guest-scheduler");
    startLocalEveGuestCleanup();
  }
}
