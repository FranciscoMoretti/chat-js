import { config } from "dotenv";
import { inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import type { ChatMessage } from "@/lib/ai/types";
import { mapUIMessagePartsToDBParts } from "@/lib/utils/message-mapping";

import { message, part } from "./schema";

config({
  path: ".env.local",
});

async function processMessage(
  msg: {
    id: string;
    parts?: unknown;
  },
  db: ReturnType<typeof drizzle>
): Promise<{ success: boolean; hasParts: boolean }> {
  const parts = (msg as { parts?: unknown }).parts as
    | ChatMessage["parts"]
    | null
    | undefined;

  if (!Array.isArray(parts) || parts.length === 0) {
    return { success: true, hasParts: false };
  }

  const dbParts = mapUIMessagePartsToDBParts(parts, msg.id);

  if (dbParts.length > 0) {
    await db.transaction(async (tx) => {
      await tx.insert(part).values(dbParts);
    });
    return { success: true, hasParts: true };
  }

  return { success: true, hasParts: false };
}

async function processBatch(
  batch: { id: string; parts?: unknown }[],
  db: ReturnType<typeof drizzle>,
  batchNumber: number,
  totalBatches: number
): Promise<{ successCount: number; errorCount: number }> {
  let successCount = 0;
  let errorCount = 0;
  let processed = 0;

  console.log(
    `\n📦 Processing batch ${batchNumber}/${totalBatches} (${batch.length} messages)...`
  );

  for (const msg of batch) {
    try {
      const result = await processMessage(msg, db);
      if (result.hasParts) {
        successCount += 1;
      }
      processed += 1;

      if (processed % 10 === 0) {
        console.log(
          `  ✓ Processed ${processed}/${batch.length} messages in batch`
        );
      }
    } catch (error) {
      errorCount += 1;
      console.error(
        `  ✗ Error processing message ${msg.id}:`,
        error instanceof Error ? error.message : String(error)
      );
      processed += 1;
    }
  }

  return { successCount, errorCount };
}

const runBackfill = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not defined");
  }

  const connection = postgres(process.env.DATABASE_URL, { max: 1 });
  const db = drizzle(connection);

  console.log("⏳ Starting parts backfill...");

  const start = Date.now();

  try {
    // Get all messages
    const allMessages = await db.select().from(message);
    console.log(`📊 Found ${allMessages.length} messages to process`);

    if (allMessages.length === 0) {
      console.log("✅ No messages to backfill");
      process.exit(0);
    }

    // Get all existing parts to skip messages that already have parts
    const messageIds = allMessages.map((msg) => msg.id);
    const existingParts = await db
      .select({ messageId: part.messageId })
      .from(part)
      .where(inArray(part.messageId, messageIds));

    const messagesWithParts = new Set(existingParts.map((p) => p.messageId));

    // Filter messages that need backfilling
    const messagesToBackfill = allMessages.filter(
      (msg) => !messagesWithParts.has(msg.id)
    );

    console.log(
      `📝 ${messagesToBackfill.length} messages need backfilling (${allMessages.length - messagesToBackfill.length} already have parts)`
    );

    if (messagesToBackfill.length === 0) {
      console.log("✅ All messages already have parts in Part table");
      process.exit(0);
    }

    // Process messages in batches to avoid memory issues
    const batchSize = 100;
    let totalSuccessCount = 0;
    let totalErrorCount = 0;

    for (let i = 0; i < messagesToBackfill.length; i += batchSize) {
      const batch = messagesToBackfill.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(messagesToBackfill.length / batchSize);

      const { successCount, errorCount } = await processBatch(
        batch,
        db,
        batchNumber,
        totalBatches
      );

      totalSuccessCount += successCount;
      totalErrorCount += errorCount;
    }

    const processed = messagesToBackfill.length;

    const end = Date.now();
    const duration = ((end - start) / 1000).toFixed(2);

    console.log("\n✅ Backfill completed!");
    console.log(`   Total messages processed: ${processed}`);
    console.log(`   Successfully backfilled: ${totalSuccessCount}`);
    console.log(`   Errors: ${totalErrorCount}`);
    console.log(`   Duration: ${duration}s`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Backfill failed");
    console.error(error);
    process.exit(1);
  } finally {
    await connection.end();
  }
};

runBackfill().catch((err) => {
  console.error("❌ Backfill failed");
  console.error(err);
  process.exit(1);
});
