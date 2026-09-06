import { useSwitchToSibling } from "@/lib/stores/hooks-threads";

/** Navigation changes only the calling view. Execution and workspace stay attached. */
export function useNavigateToSibling() {
  return useSwitchToSibling();
}
