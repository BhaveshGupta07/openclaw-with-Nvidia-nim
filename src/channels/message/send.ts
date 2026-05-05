import type { ReplyPayload } from "../../auto-reply/reply-payload.js";
import type { OutboundDeliveryResult } from "../../infra/outbound/deliver-types.js";
import {
  deliverOutboundPayloads,
  type DeliverOutboundPayloadsParams,
  type OutboundDeliveryIntent,
} from "../../infra/outbound/deliver.js";
import { createMessageReceiptFromOutboundResults } from "./receipt.js";
import type {
  DurableMessageSendIntent,
  MessageDurabilityPolicy,
  MessageReceipt,
  MessageSendContext,
  RenderedMessageBatch,
  RenderedMessageBatchPlan,
} from "./types.js";

export type DurableMessageBatchSendParams = Omit<
  DeliverOutboundPayloadsParams,
  "onDeliveryIntent" | "payloads" | "queuePolicy"
> & {
  payloads: ReplyPayload[];
  attempt?: number;
  signal?: AbortSignal;
  previousReceipt?: MessageReceipt;
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

const neverAbortedSignal = new AbortController().signal;

function toDurableMessageIntent(
  intent: OutboundDeliveryIntent,
  renderedBatch: RenderedMessageBatch<ReplyPayload>,
): DurableMessageSendIntent<ReplyPayload> {
  return {
    id: intent.id,
    channel: intent.channel,
    to: intent.to,
    ...(intent.accountId ? { accountId: intent.accountId } : {}),
    durability: intent.queuePolicy === "required" ? "required" : "best_effort",
    renderedBatch,
  };
}

function countMedia(payload: ReplyPayload): number {
  return (payload.mediaUrls?.filter(Boolean).length ?? 0) + (payload.mediaUrl ? 1 : 0);
}

function createRenderedMessageBatchPlan(
  payloads: readonly ReplyPayload[],
): RenderedMessageBatchPlan {
  return payloads.reduce<RenderedMessageBatchPlan>(
    (plan, payload) => {
      const text = payload.text?.trim();
      const mediaCount = countMedia(payload);
      return {
        payloadCount: plan.payloadCount + 1,
        textCount: plan.textCount + (text ? 1 : 0),
        mediaCount: plan.mediaCount + mediaCount,
        voiceCount: plan.voiceCount + (payload.audioAsVoice && mediaCount > 0 ? 1 : 0),
        presentationCount: plan.presentationCount + (payload.presentation?.blocks?.length ? 1 : 0),
        interactiveCount: plan.interactiveCount + (payload.interactive ? 1 : 0),
        channelDataCount: plan.channelDataCount + (payload.channelData ? 1 : 0),
      };
    },
    {
      payloadCount: 0,
      textCount: 0,
      mediaCount: 0,
      voiceCount: 0,
      presentationCount: 0,
      interactiveCount: 0,
      channelDataCount: 0,
    },
  );
}

function createRenderedMessageBatch(payloads: ReplyPayload[]): RenderedMessageBatch<ReplyPayload> {
  return {
    payloads,
    plan: createRenderedMessageBatchPlan(payloads),
  };
}

export type DurableMessageSendContextParams = DurableMessageBatchSendParams & {
  durability?: Exclude<MessageDurabilityPolicy, "disabled">;
  onCommitReceipt?: (receipt: MessageReceipt) => Promise<void> | void;
  onSendFailure?: (error: unknown) => Promise<void> | void;
};

export type DurableMessageSendContext = MessageSendContext<
  ReplyPayload,
  DurableMessageBatchSendResult
>;

export async function withDurableMessageSendContext<T>(
  params: DurableMessageSendContextParams,
  run: (ctx: DurableMessageSendContext) => Promise<T>,
): Promise<T> {
  let deliveryIntent: OutboundDeliveryIntent | undefined;
  const {
    attempt,
    durability,
    onCommitReceipt,
    onSendFailure,
    payloads,
    previousReceipt,
    signal,
    ...deliveryParams
  } = params;
  const ctx: DurableMessageSendContext = {
    id: `${params.channel}:${params.to}`,
    channel: params.channel,
    to: params.to,
    ...(params.accountId ? { accountId: params.accountId } : {}),
    durability: durability ?? "required",
    attempt: attempt ?? 1,
    signal: signal ?? neverAbortedSignal,
    ...(previousReceipt ? { previousReceipt } : {}),
    render: async (): Promise<RenderedMessageBatch<ReplyPayload>> =>
      createRenderedMessageBatch(payloads),
    send: async (rendered): Promise<DurableMessageBatchSendResult> => {
      try {
        const results = await deliverOutboundPayloads({
          ...deliveryParams,
          payloads: rendered.payloads,
          queuePolicy: "required",
          onDeliveryIntent: (intent) => {
            deliveryIntent = intent;
            ctx.intent = toDurableMessageIntent(intent, rendered);
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
    },
    commit: async (receipt) => {
      await onCommitReceipt?.(receipt);
    },
    fail: async (error) => {
      await onSendFailure?.(error);
    },
  };

  try {
    const result = await run(ctx);
    return result;
  } catch (error: unknown) {
    await ctx.fail(error);
    throw error;
  }
}

export async function sendDurableMessageBatch(
  params: DurableMessageSendContextParams,
): Promise<DurableMessageBatchSendResult> {
  return await withDurableMessageSendContext(params, async (ctx) => {
    const rendered = await ctx.render();
    const result = await ctx.send(rendered);
    if (result.status !== "failed") {
      await ctx.commit(result.receipt);
    } else {
      await ctx.fail(result.error);
    }
    return result;
  });
}
