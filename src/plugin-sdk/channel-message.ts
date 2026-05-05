import type { ChannelMessageAdapter } from "../channels/message/index.js";
export {
  deliverInboundReplyWithMessageSendContext,
  type DurableInboundReplyDeliveryOptions,
  type DurableInboundReplyDeliveryParams,
  type DurableInboundReplyDeliveryResult,
} from "../channels/turn/kernel.js";

export {
  classifyDurableSendRecoveryState,
  createMessageReceiptFromOutboundResults,
  createMessageReceiveContext,
  deriveDurableFinalDeliveryRequirements,
  listDeclaredDurableFinalCapabilities,
  createLiveMessageState,
  createDurableMessageStateRecord,
  markLiveMessageCancelled,
  markLiveMessageFinalized,
  markLiveMessagePreviewUpdated,
  shouldAckMessageAfterStage,
  verifyDurableFinalCapabilityProofs,
} from "../channels/message/index.js";
export type {
  ChannelMessageAdapter,
  DeriveDurableFinalDeliveryRequirementsParams,
  DurableFinalCapabilityProof,
  DurableFinalCapabilityProofMap,
  DurableFinalCapabilityProofResult,
  DurableFinalDeliveryCapability,
  DurableFinalDeliveryPayloadShape,
  DurableFinalDeliveryRequirementMap,
  DurableFinalRequirementExtras,
  DurableMessageSendIntent,
  DurableMessageSendState,
  DurableMessageStateRecord,
  LiveMessagePhase,
  LiveMessageState,
  MessageAckPolicy,
  MessageAckStage,
  MessageAckState,
  MessageReceiveContext,
  MessageSendContext,
  MessageDurabilityPolicy,
  MessageReceipt,
  MessageReceiptPart,
  MessageReceiptPartKind,
  MessageReceiptSourceResult,
  RenderedMessageBatch,
  RenderedMessageBatchPlan,
} from "../channels/message/index.js";

export function defineChannelMessageAdapter<const TAdapter extends object>(
  adapter: TAdapter,
): ChannelMessageAdapter<TAdapter> {
  return adapter;
}
