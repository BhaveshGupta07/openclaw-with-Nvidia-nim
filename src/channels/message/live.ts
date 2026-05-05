import type { LiveMessageState, MessageReceipt, RenderedMessageBatch } from "./types.js";
export type { LiveMessagePhase, LiveMessageState } from "./types.js";

export type LivePreviewFinalizerDraft<TId> = {
  flush: () => Promise<void>;
  id: () => TId | undefined;
  seal?: () => Promise<void>;
  discardPending?: () => Promise<void>;
  clear: () => Promise<void>;
};

export type LivePreviewFinalizerResultKind =
  | "normal-delivered"
  | "normal-skipped"
  | "preview-finalized";

export type LivePreviewFinalizerResult<TPayload> = {
  kind: LivePreviewFinalizerResultKind;
  liveState?: LiveMessageState<TPayload>;
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

export function createPreviewMessageReceipt(params: {
  id: unknown;
  threadId?: string;
  replyToId?: string;
  sentAt?: number;
  raw?: unknown;
}): MessageReceipt {
  const platformMessageId = String(params.id);
  return {
    primaryPlatformMessageId: platformMessageId,
    platformMessageIds: [platformMessageId],
    parts: [
      {
        platformMessageId,
        kind: "preview",
        index: 0,
        ...(params.threadId ? { threadId: params.threadId } : {}),
        ...(params.replyToId ? { replyToId: params.replyToId } : {}),
      },
    ],
    ...(params.threadId ? { threadId: params.threadId } : {}),
    ...(params.replyToId ? { replyToId: params.replyToId } : {}),
    sentAt: params.sentAt ?? Date.now(),
    ...(params.raw === undefined ? {} : { raw: [{ meta: { raw: params.raw } }] }),
  };
}

export async function deliverFinalizableLivePreview<TPayload, TId, TEdit>(params: {
  kind: "tool" | "block" | "final";
  payload: TPayload;
  liveState?: LiveMessageState<TPayload>;
  draft?: LivePreviewFinalizerDraft<TId>;
  buildFinalEdit: (payload: TPayload) => TEdit | undefined;
  editFinal: (id: TId, edit: TEdit) => Promise<void>;
  deliverNormally: (payload: TPayload) => Promise<boolean | void>;
  createPreviewReceipt?: (id: TId, edit: TEdit) => MessageReceipt;
  onPreviewFinalized?: (
    id: TId,
    receipt: MessageReceipt,
    liveState: LiveMessageState<TPayload>,
  ) => Promise<void> | void;
  onNormalDelivered?: () => Promise<void> | void;
  logPreviewEditFailure?: (error: unknown) => void;
}): Promise<LivePreviewFinalizerResult<TPayload>> {
  let liveState =
    params.liveState ??
    createLiveMessageState<TPayload>({ canFinalizeInPlace: Boolean(params.draft) });

  if (params.kind !== "final" || !params.draft) {
    const delivered = await params.deliverNormally(params.payload);
    if (delivered === false) {
      return { kind: "normal-skipped", liveState };
    }
    await params.onNormalDelivered?.();
    return { kind: "normal-delivered", liveState };
  }

  const edit = liveState.canFinalizeInPlace ? params.buildFinalEdit(params.payload) : undefined;
  if (edit !== undefined) {
    await params.draft.flush();
    const previewId = params.draft.id();
    if (previewId !== undefined) {
      await params.draft.seal?.();
      try {
        await params.editFinal(previewId, edit);
        const receipt =
          params.createPreviewReceipt?.(previewId, edit) ??
          createPreviewMessageReceipt({ id: previewId });
        liveState = markLiveMessageFinalized(liveState, receipt);
        await params.onPreviewFinalized?.(previewId, receipt, liveState);
        return { kind: "preview-finalized", liveState };
      } catch (err) {
        params.logPreviewEditFailure?.(err);
      }
    }
  }

  if (params.draft.discardPending) {
    await params.draft.discardPending();
  } else {
    await params.draft.clear();
  }
  liveState = markLiveMessageCancelled(liveState);

  let delivered = false;
  try {
    const result = await params.deliverNormally(params.payload);
    delivered = result !== false;
    if (delivered) {
      await params.onNormalDelivered?.();
    }
  } finally {
    if (delivered) {
      await params.draft.clear();
    }
  }

  return { kind: delivered ? "normal-delivered" : "normal-skipped", liveState };
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
