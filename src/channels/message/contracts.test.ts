import { describe, expect, it, vi } from "vitest";
import {
  listDeclaredDurableFinalCapabilities,
  verifyDurableFinalCapabilityProofs,
} from "./contracts.js";

describe("durable final capability contracts", () => {
  it("lists declared durable-final capabilities in stable order", () => {
    expect(
      listDeclaredDurableFinalCapabilities({
        batch: true,
        text: true,
        silent: false,
        thread: true,
      }),
    ).toEqual(["text", "thread", "batch"]);
  });

  it("runs proofs for every declared durable-final capability", async () => {
    const text = vi.fn();
    const silent = vi.fn(async () => {});

    await expect(
      verifyDurableFinalCapabilityProofs({
        adapterName: "demo",
        capabilities: {
          text: true,
          silent: true,
        },
        proofs: {
          text,
          silent,
        },
      }),
    ).resolves.toEqual(
      expect.arrayContaining([
        { capability: "text", status: "verified" },
        { capability: "silent", status: "verified" },
      ]),
    );
    expect(text).toHaveBeenCalledTimes(1);
    expect(silent).toHaveBeenCalledTimes(1);
  });

  it("fails when a declared durable-final capability has no proof", async () => {
    await expect(
      verifyDurableFinalCapabilityProofs({
        adapterName: "demo",
        capabilities: {
          text: true,
          nativeQuote: true,
        },
        proofs: {
          text: () => {},
        },
      }),
    ).rejects.toThrow(
      'demo declares durable final capability "nativeQuote" without a contract proof',
    );
  });
});
