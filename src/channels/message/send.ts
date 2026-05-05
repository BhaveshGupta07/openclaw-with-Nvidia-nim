import type { ReplyPayload } from "../../auto-reply/reply-payload.js";
import type { OutboundDeliveryResult } from "../../infra/outbound/deliver-types.js";
import {
  deliverOutboundPayloads,
  type DeliverOutboundPayloadsParams,
  type OutboundDeliveryIntent,
} from "../../infra/outbound/deliver.js";
import { createMessageReceiptFromOutboundResults } from "./receipt.js";
import type { MessageReceipt } from "./types.js";

export type DurableMessageBatchSendParams = Omit<
  DeliverOutboundPayloadsParams,
  "onDeliveryIntent" | "payloads" | "queuePolicy"
> & {
  payloads: ReplyPayload[];
};

export type DurableMessageBatchSendResult =
  | {
      status: "sent";
      results: OutboundDeliveryResult[];
      receipt: MessageReceipt;
      deliveryIntent?: OutboundDeliveryIntent;
    }
  | {
      status: "suppressed";
      results: [];
      receipt: MessageReceipt;
      deliveryIntent?: OutboundDeliveryIntent;
      reason: "no_visible_result";
    }
  | { status: "failed"; error: unknown };

export async function sendDurableMessageBatch(
  params: DurableMessageBatchSendParams,
): Promise<DurableMessageBatchSendResult> {
  let deliveryIntent: OutboundDeliveryIntent | undefined;
  try {
    const results = await deliverOutboundPayloads({
      ...params,
      queuePolicy: "required",
      onDeliveryIntent: (intent) => {
        deliveryIntent = intent;
      },
    });
    const receipt = createMessageReceiptFromOutboundResults({
      results,
      threadId: params.threadId == null ? undefined : String(params.threadId),
      replyToId: params.replyToId ?? undefined,
    });
    if (results.length === 0) {
      return {
        status: "suppressed",
        results: [],
        receipt,
        ...(deliveryIntent ? { deliveryIntent } : {}),
        reason: "no_visible_result",
      };
    }
    return {
      status: "sent",
      results,
      receipt,
      ...(deliveryIntent ? { deliveryIntent } : {}),
    };
  } catch (error: unknown) {
    return { status: "failed", error };
  }
}
