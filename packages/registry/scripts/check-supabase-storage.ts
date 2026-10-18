import { Files } from "files-sdk";
import { z } from "zod";

import { createStorageAdapter } from "../src/storage/supabase/storage-provider";

const minimumConfigurationLength = 1;
const configurationSchema = z.object({
  SUPABASE_ACCEPTANCE_BUCKET: z.string().min(minimumConfigurationLength),
  SUPABASE_ACCEPTANCE_KEY: z.string().min(minimumConfigurationLength),
  SUPABASE_ACCEPTANCE_URL: z
    .url()
    .refine((value) => new URL(value).protocol === "https:"),
});
const deniedStatuses = new Set(
  Object.values({
    badRequest: 400,
    forbidden: 403,
    notFound: 404,
    unauthorized: 401,
  })
);
const signedUrlSeconds = 60;
const requestTimeoutMs = 10_000;

const assertCondition = (condition: boolean): void => {
  if (!condition) {
    throw new Error("Supabase acceptance assertion failed");
  }
};

const assertContents = async (
  files: Files,
  key: string,
  contents: string
): Promise<void> => {
  assertCondition(await files.exists(key));
  const file = await files.download(key);
  assertCondition((await file.text()) === contents);
};

const checkSupabaseStorage = async (): Promise<void> => {
  const configuration = configurationSchema.safeParse(process.env);
  if (!configuration.success) {
    throw new Error("Missing dedicated Supabase acceptance configuration");
  }
  const {
    SUPABASE_ACCEPTANCE_BUCKET: bucket,
    SUPABASE_ACCEPTANCE_KEY: key,
    SUPABASE_ACCEPTANCE_URL: url,
  } = configuration.data;
  const adapter = createStorageAdapter({ bucket, key, public: false, url });
  const metadata = await adapter.raw.getBucket(bucket);
  if (metadata.error) {
    throw new Error("Cannot verify private bucket metadata");
  }
  assertCondition(!metadata.data.public);
  const files = new Files({ adapter, retries: 0, timeout: requestTimeoutMs });
  const prefix = `chatjs-acceptance/${crypto.randomUUID()}`;
  const original = `${prefix}/original.txt`;
  const copied = `${prefix}/copy.txt`;
  const contents = `Disposable ChatJS storage acceptance ${prefix}`;
  try {
    await files.upload(original, contents, { contentType: "text/plain" });
    await assertContents(files, original, contents);
    const publicUrl = new URL(
      `/storage/v1/object/public/${encodeURIComponent(bucket)}/${original}`,
      url
    );
    const unsigned = await fetch(publicUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    assertCondition(deniedStatuses.has(unsigned.status));
    const signedUrl = await files.url(original, {
      expiresIn: signedUrlSeconds,
    });
    assertCondition(new URL(signedUrl).origin === new URL(url).origin);
    const signed = await fetch(signedUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    assertCondition(signed.ok && (await signed.text()) === contents);
    await files.copy(original, copied);
    await files.delete(original);
    assertCondition(!(await files.exists(original)));
    await assertContents(files, copied, contents);
    await files.delete(copied);
    assertCondition(!(await files.exists(copied)));
  } finally {
    // Repeated deletion must be idempotent. A failure remains a failing check.
    await Promise.all([files.delete(original), files.delete(copied)]);
  }
};

if (import.meta.main) {
  try {
    await checkSupabaseStorage();
    process.stdout.write(
      "Supabase private storage acceptance passed; disposable objects removed.\n"
    );
  } catch {
    process.stderr.write(
      "Supabase storage acceptance failed or configuration unavailable. Set SUPABASE_ACCEPTANCE_URL, SUPABASE_ACCEPTANCE_KEY and SUPABASE_ACCEPTANCE_BUCKET for an authorized private test bucket. Inspect that bucket for chatjs-acceptance objects before retrying; no provider payloads or credentials are printed.\n"
    );
    process.exitCode = 1;
  }
}
