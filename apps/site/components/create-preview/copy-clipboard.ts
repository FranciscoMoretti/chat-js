import { toast } from "sonner";

// Keep upstream copy call sites; report browser failures instead of claiming success.
export const copyToClipboardWithMeta = async (
  text: string,
  _meta: Readonly<{
    name: string;
    properties?: Readonly<Record<string, unknown>>;
  }>
): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    toast.error("Could not copy. Select the text and copy it manually.");
    return false;
  }
};
