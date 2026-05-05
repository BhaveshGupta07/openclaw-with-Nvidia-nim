export type MessageAckPolicy =
  | "after_receive_record"
  | "after_agent_dispatch"
  | "after_durable_send"
  | "manual";

export type MessageReceiveContext<TMessage = unknown> = {
  id: string;
  channel: string;
  accountId?: string;
  message: TMessage;
  ackPolicy: MessageAckPolicy;
  receivedAt: number;
  signal: AbortSignal;
};

const neverAbortedSignal = new AbortController().signal;

export function createMessageReceiveContext<TMessage>(params: {
  id: string;
  channel: string;
  accountId?: string;
  message: TMessage;
  ackPolicy?: MessageAckPolicy;
  receivedAt?: number;
  signal?: AbortSignal;
}): MessageReceiveContext<TMessage> {
  return {
    id: params.id,
    channel: params.channel,
    ...(params.accountId ? { accountId: params.accountId } : {}),
    message: params.message,
    ackPolicy: params.ackPolicy ?? "after_receive_record",
    receivedAt: params.receivedAt ?? Date.now(),
    signal: params.signal ?? neverAbortedSignal,
  };
}
