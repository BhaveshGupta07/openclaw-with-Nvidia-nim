import type { ChannelMessageAdapter } from "../channels/message/index.js";

export {
  createMessageReceiptFromOutboundResults,
  deriveDurableFinalDeliveryRequirements,
  listDeclaredDurableFinalCapabilities,
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
  MessageSendContext,
  MessageDurabilityPolicy,
  MessageReceipt,
  MessageReceiptPart,
  MessageReceiptPartKind,
  MessageReceiptSourceResult,
  RenderedMessageBatch,
} from "../channels/message/index.js";

export function defineChannelMessageAdapter<const TAdapter extends object>(
  adapter: TAdapter,
): ChannelMessageAdapter<TAdapter> {
  return adapter;
}
