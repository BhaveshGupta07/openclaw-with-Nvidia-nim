import type { LiveMessageState, MessageReceipt, RenderedMessageBatch } from "./types.js";
export type { LiveMessagePhase, LiveMessageState } from "./types.js";

export function createLiveMessageState<TPayload = unknown>(params?: {
  receipt?: MessageReceipt;
  lastRendered?: RenderedMessageBatch<TPayload>;
  canFinalizeInPlace?: boolean;
}): LiveMessageState<TPayload> {
  return {
    phase: params?.receipt ? "previewing" : "idle",
    canFinalizeInPlace: params?.canFinalizeInPlace ?? Boolean(params?.receipt),
    ...(params?.receipt ? { receipt: params.receipt } : {}),
    ...(params?.lastRendered ? { lastRendered: params.lastRendered } : {}),
  };
}

export function markLiveMessageFinalized<TPayload>(
  state: LiveMessageState<TPayload>,
  receipt: MessageReceipt,
): LiveMessageState<TPayload> {
  return {
    ...state,
    phase: "finalized",
    receipt,
    canFinalizeInPlace: false,
  };
}

export function markLiveMessagePreviewUpdated<TPayload>(
  state: LiveMessageState<TPayload>,
  rendered: RenderedMessageBatch<TPayload>,
): LiveMessageState<TPayload> {
  return {
    ...state,
    phase: "previewing",
    lastRendered: rendered,
  };
}

export function markLiveMessageCancelled<TPayload>(
  state: LiveMessageState<TPayload>,
): LiveMessageState<TPayload> {
  return {
    ...state,
    phase: "cancelled",
    canFinalizeInPlace: false,
  };
}
