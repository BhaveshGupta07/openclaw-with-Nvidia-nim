import type {
  DurableFinalDeliveryCapability,
  DurableFinalDeliveryRequirementMap,
} from "./types.js";

export type DurableFinalCapabilityProof = () => Promise<void> | void;

export type DurableFinalCapabilityProofMap = Partial<
  Record<DurableFinalDeliveryCapability, DurableFinalCapabilityProof>
>;

export type DurableFinalCapabilityProofResult = {
  capability: DurableFinalDeliveryCapability;
  status: "verified" | "not_declared";
};

const durableFinalCapabilityOrder: readonly DurableFinalDeliveryCapability[] = [
  "text",
  "media",
  "payload",
  "silent",
  "replyTo",
  "thread",
  "nativeQuote",
  "messageSendingHooks",
  "batch",
];

export function listDeclaredDurableFinalCapabilities(
  capabilities: DurableFinalDeliveryRequirementMap | undefined,
): DurableFinalDeliveryCapability[] {
  return durableFinalCapabilityOrder.filter((capability) => capabilities?.[capability] === true);
}

export async function verifyDurableFinalCapabilityProofs(params: {
  adapterName: string;
  capabilities?: DurableFinalDeliveryRequirementMap;
  proofs: DurableFinalCapabilityProofMap;
}): Promise<DurableFinalCapabilityProofResult[]> {
  const results: DurableFinalCapabilityProofResult[] = [];
  for (const capability of durableFinalCapabilityOrder) {
    if (params.capabilities?.[capability] !== true) {
      results.push({ capability, status: "not_declared" });
      continue;
    }
    const proof = params.proofs[capability];
    if (!proof) {
      throw new Error(
        `${params.adapterName} declares durable final capability "${capability}" without a contract proof`,
      );
    }
    await proof();
    results.push({ capability, status: "verified" });
  }
  return results;
}
