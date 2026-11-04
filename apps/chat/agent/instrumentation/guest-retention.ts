import { otel } from "eve/instrumentation/otel";
import { guestTracePolicy } from "@/chatjs/plugins/guest-chat/guest-retention";

export default otel({ tracePolicy: guestTracePolicy });
