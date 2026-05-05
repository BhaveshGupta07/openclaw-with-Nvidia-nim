import type { MessageReceipt, RenderedMessageBatch } from "./types.js";

export type LiveMessagePhase = "idle" | "previewing" | "finalizing" | "finalized" | "cancelled";

export type LiveMessageState<TPayload = unknown> = {
  phase: LiveMessagePhase;
  canFinalizeInPlace: boolean;
  receipt?: MessageReceipt;
  lastRendered?: RenderedMessageBatch<TPayload>;
};

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

export function markLiveMessageCancelled<TPayload>(
  state: LiveMessageState<TPayload>,
): LiveMessageState<TPayload> {
  return {
    ...state,
    phase: "cancelled",
    canFinalizeInPlace: false,
  };
}
