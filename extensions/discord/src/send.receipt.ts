import {
  createMessageReceiptFromOutboundResults,
  type MessageReceipt,
  type MessageReceiptPartKind,
  type MessageReceiptSourceResult,
} from "openclaw/plugin-sdk/channel-message";
import type { DiscordSendResult } from "./send.types.js";

export type DiscordReceiptResultSource = {
  id?: string | null;
  channel_id?: string | null;
  messageIds?: readonly string[];
};

export function createDiscordSendReceipt(params: {
  messageIds: readonly string[];
  channelId?: string;
  kind: MessageReceiptPartKind;
  threadId?: string;
  replyToId?: string;
}): MessageReceipt {
  const messageIds = params.messageIds
    .map((messageId) => messageId.trim())
    .filter((messageId) => messageId && messageId !== "unknown");
  return createMessageReceiptFromOutboundResults({
    results: messageIds.map((messageId) => {
      const result: MessageReceiptSourceResult = {
        channel: "discord",
        messageId,
      };
      if (params.channelId) {
        result.channelId = params.channelId;
      }
      return result;
    }),
    kind: params.kind,
    threadId: params.threadId,
    replyToId: params.replyToId,
  });
}

export function createDiscordSendResult(params: {
  result: DiscordReceiptResultSource;
  fallbackChannelId: string;
  kind: MessageReceiptPartKind;
  threadId?: string | number;
  replyToId?: string;
}): DiscordSendResult {
  const messageId = params.result.id || "unknown";
  const channelId = params.result.channel_id ?? params.fallbackChannelId;
  const receiptParams: Parameters<typeof createDiscordSendReceipt>[0] = {
    messageIds: params.result.messageIds?.length ? params.result.messageIds : [messageId],
    channelId,
    kind: params.kind,
  };
  if (params.threadId != null) {
    receiptParams.threadId = String(params.threadId);
  }
  if (params.replyToId) {
    receiptParams.replyToId = params.replyToId;
  }
  return {
    messageId,
    channelId,
    receipt: createDiscordSendReceipt(receiptParams),
  };
}
