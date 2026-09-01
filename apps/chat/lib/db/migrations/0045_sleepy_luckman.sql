CREATE TABLE "GenerationCancellation" (
	"messageId" uuid NOT NULL,
	"userId" text NOT NULL,
	"chatId" uuid NOT NULL,
	"canceledAt" timestamp NOT NULL,
	CONSTRAINT "GenerationCancellation_messageId_userId_pk" PRIMARY KEY("messageId","userId")
);
--> statement-breakpoint
ALTER TABLE "GenerationCancellation" ADD CONSTRAINT "GenerationCancellation_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;