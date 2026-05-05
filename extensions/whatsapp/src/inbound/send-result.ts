import type { WAMessage, WAMessageKey } from "@whiskeysockets/baileys";
import {
  createMessageReceiptFromOutboundResults,
  type MessageReceipt,
  type MessageReceiptPartKind,
  type MessageReceiptSourceResult,
} from "openclaw/plugin-sdk/channel-message";

export type WhatsAppSendKind = "media" | "poll" | "reaction" | "text";

type WhatsAppSendKey = Omit<
  Pick<WAMessageKey, "fromMe" | "id" | "participant" | "remoteJid">,
  "id"
> & {
  id: string;
};

export type WhatsAppSendResult = {
  kind: WhatsAppSendKind;
  messageId: string;
  messageIds: string[];
  receipt?: MessageReceipt;
  keys: WhatsAppSendKey[];
  providerAccepted: boolean;
};

function resolveWhatsAppReceiptKind(kind: WhatsAppSendKind): MessageReceiptPartKind {
  if (kind === "media" || kind === "text") {
    return kind;
  }
  return "unknown";
}

function toReceiptSourceResult(key: WhatsAppSendKey): MessageReceiptSourceResult {
  return {
    channel: "whatsapp",
    messageId: key.id,
    ...(key.remoteJid ? { toJid: key.remoteJid } : {}),
    meta: {
      fromMe: key.fromMe,
      participant: key.participant,
    },
  };
}

function createWhatsAppSendReceipt(
  kind: WhatsAppSendKind,
  keys: readonly WhatsAppSendKey[],
): MessageReceipt {
  return createMessageReceiptFromOutboundResults({
    kind: resolveWhatsAppReceiptKind(kind),
    results: keys.map(toReceiptSourceResult),
  });
}

function normalizeKey(key: WAMessageKey | undefined): WhatsAppSendKey | undefined {
  const id = typeof key?.id === "string" ? key.id.trim() : "";
  if (!id) {
    return undefined;
  }
  return {
    id,
    remoteJid: key?.remoteJid,
    fromMe: key?.fromMe,
    participant: key?.participant,
  };
}

export function normalizeWhatsAppSendResult(
  result: WAMessage | undefined,
  kind: WhatsAppSendKind,
): WhatsAppSendResult {
  const key = normalizeKey(result?.key);
  const messageId = key?.id ?? "unknown";
  return {
    kind,
    messageId,
    messageIds: key ? [key.id] : [],
    receipt: createWhatsAppSendReceipt(kind, key ? [key] : []),
    keys: key ? [key] : [],
    providerAccepted: Boolean(key),
  };
}

export function combineWhatsAppSendResults(
  kind: WhatsAppSendKind,
  results: readonly WhatsAppSendResult[],
): WhatsAppSendResult {
  const messageIds = [...new Set(results.flatMap((result) => result.messageIds))];
  const keys = results.flatMap((result) => result.keys);
  return {
    kind,
    messageId: messageIds[0] ?? "unknown",
    messageIds,
    receipt: createWhatsAppSendReceipt(kind, keys),
    keys,
    providerAccepted: results.some((result) => result.providerAccepted),
  };
}
