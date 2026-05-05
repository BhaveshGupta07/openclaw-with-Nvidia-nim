import { describe, expect, it, vi } from "vitest";
import {
  createLiveMessageState,
  markLiveMessageCancelled,
  markLiveMessageFinalized,
  markLiveMessagePreviewUpdated,
} from "./live.js";
import { createMessageReceiveContext, shouldAckMessageAfterStage } from "./receive.js";
import { classifyDurableSendRecoveryState, createDurableMessageStateRecord } from "./state.js";

describe("message lifecycle primitives", () => {
  it("tracks live preview finalization state", () => {
    const receipt = {
      primaryPlatformMessageId: "m1",
      platformMessageIds: ["m1"],
      parts: [],
      sentAt: 123,
    };

    const preview = createLiveMessageState({ receipt });
    expect(preview).toEqual(
      expect.objectContaining({
        phase: "previewing",
        canFinalizeInPlace: true,
      }),
    );

    expect(markLiveMessageFinalized(preview, receipt)).toEqual(
      expect.objectContaining({
        phase: "finalized",
        canFinalizeInPlace: false,
      }),
    );
    expect(markLiveMessageCancelled(preview)).toEqual(
      expect.objectContaining({
        phase: "cancelled",
        canFinalizeInPlace: false,
      }),
    );
  });

  it("tracks live preview rendered batch updates", () => {
    const preview = createLiveMessageState();
    const rendered = {
      payloads: [{ text: "draft" }],
      plan: {
        payloadCount: 1,
        textCount: 1,
        mediaCount: 0,
        voiceCount: 0,
        presentationCount: 0,
        interactiveCount: 0,
        channelDataCount: 0,
      },
    };

    expect(markLiveMessagePreviewUpdated(preview, rendered)).toEqual(
      expect.objectContaining({
        phase: "previewing",
        lastRendered: rendered,
      }),
    );
  });

  it("creates receive contexts with explicit ack policy defaults", () => {
    const ctx = createMessageReceiveContext({
      id: "rx-1",
      channel: "telegram",
      message: { text: "hello" },
      receivedAt: 123,
    });

    expect(ctx).toEqual(
      expect.objectContaining({
        id: "rx-1",
        channel: "telegram",
        message: { text: "hello" },
        ackPolicy: "after_receive_record",
        ackState: "pending",
        receivedAt: 123,
      }),
    );
  });

  it("acks and nacks receive contexts through explicit hooks", async () => {
    const onAck = vi.fn(async () => undefined);
    const onNack = vi.fn(async () => undefined);
    const ctx = createMessageReceiveContext({
      id: "rx-ack",
      channel: "telegram",
      message: { text: "hello" },
      ackPolicy: "after_durable_send",
      onAck,
      onNack,
    });

    expect(ctx.shouldAckAfter("receive_record")).toBe(false);
    expect(ctx.shouldAckAfter("durable_send")).toBe(true);

    await ctx.ack();
    await ctx.ack();
    expect(onAck).toHaveBeenCalledTimes(1);
    expect(ctx.ackState).toBe("acked");
    expect(ctx.ackedAt).toEqual(expect.any(Number));

    await ctx.nack(new Error("offset failed"));
    expect(onNack).toHaveBeenCalledWith(expect.any(Error));
    expect(ctx.ackState).toBe("nacked");
    expect(ctx.nackErrorMessage).toBe("offset failed");
  });

  it("maps ack policies to lifecycle stages", () => {
    expect(shouldAckMessageAfterStage("after_receive_record", "receive_record")).toBe(true);
    expect(shouldAckMessageAfterStage("after_receive_record", "agent_dispatch")).toBe(false);
    expect(shouldAckMessageAfterStage("after_agent_dispatch", "agent_dispatch")).toBe(true);
    expect(shouldAckMessageAfterStage("after_durable_send", "durable_send")).toBe(true);
    expect(shouldAckMessageAfterStage("manual", "manual")).toBe(false);
  });

  it("classifies unknown-after-send recovery only after platform send may have started", () => {
    expect(
      classifyDurableSendRecoveryState({
        hasIntent: true,
        hasReceipt: false,
        platformSendMayHaveStarted: true,
      }),
    ).toBe("unknown_after_send");
    expect(
      classifyDurableSendRecoveryState({
        hasIntent: true,
        hasReceipt: false,
        platformSendMayHaveStarted: false,
      }),
    ).toBe("pending");
  });

  it("creates durable message state records with normalized errors", () => {
    expect(
      createDurableMessageStateRecord({
        intent: {
          id: "intent-1",
          channel: "telegram",
          to: "12345",
          durability: "required",
        },
        state: "failed",
        error: new Error("network"),
        updatedAt: 123,
      }),
    ).toEqual(
      expect.objectContaining({
        state: "failed",
        errorMessage: "network",
        updatedAt: 123,
      }),
    );
  });
});
