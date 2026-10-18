import { StorageApiError } from "@supabase/storage-js";
import { FilesError } from "files-sdk";
import type {
  SupabaseAdapter,
  SupabaseAdapterOptions,
} from "files-sdk/supabase";
import { supabase } from "files-sdk/supabase";

const badRequestStatus = 400;
const missingObjectStatus = 404;

const readObject = async <Value>(
  operation: () => Promise<Value>
): Promise<Value> => {
  try {
    return await operation();
  } catch (error) {
    // Storage can return HTTP 400 with a string object status of 404. Files SDK
    // 2.5.0 ignores that numeric string; retain all other failures as failures.
    if (
      error instanceof FilesError &&
      error.code === "Provider" &&
      error.cause instanceof StorageApiError &&
      error.cause.statusCode === "404" &&
      (error.cause.status === badRequestStatus ||
        error.cause.status === missingObjectStatus)
    ) {
      throw new FilesError("NotFound", error.message, error.cause);
    }
    throw error;
  }
};

const createStorageAdapter = (
  configuration: Readonly<SupabaseAdapterOptions>
): SupabaseAdapter => {
  const adapter = supabase(configuration);
  return {
    ...adapter,
    async download(key, options) {
      return await readObject(async () => await adapter.download(key, options));
    },
    async exists(key, options) {
      try {
        return await readObject(async () => await adapter.exists(key, options));
      } catch (error) {
        if (error instanceof FilesError && error.code === "NotFound") {
          return false;
        }
        throw error;
      }
    },
    async head(key, options) {
      return await readObject(async () => await adapter.head(key, options));
    },
    async url(key, options) {
      return await readObject(async () => await adapter.url(key, options));
    },
  };
};

export { createStorageAdapter };
