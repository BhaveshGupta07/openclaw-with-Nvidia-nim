import { buildManifestModelProviderConfig } from "openclaw/plugin-sdk/provider-catalog-shared";
import type { ModelProviderConfig } from "openclaw/plugin-sdk/provider-model-shared";
import { normalizeOptionalString } from "openclaw/plugin-sdk/text-runtime";
import { discoverNvidiaModels } from "./models.js";
import manifest from "./openclaw.plugin.json" with { type: "json" };

export const NVIDIA_DEFAULT_MODEL_ID = "nvidia/nemotron-3-super-120b-a12b";

export function buildNvidiaProvider(): ModelProviderConfig {
  return {
    ...buildManifestModelProviderConfig({
      providerId: "nvidia",
      catalog: manifest.modelCatalog.providers.nvidia,
    }),
    apiKey: "NVIDIA_API_KEY",
  };
}

export async function buildDiscoveredNvidiaProvider(params: {
  apiKey?: string;
  discoveryApiKey?: string;
  baseUrl?: string;
}): Promise<ModelProviderConfig> {
  const provider = buildNvidiaProvider();
  const baseUrl = normalizeOptionalString(params.baseUrl) ?? provider.baseUrl;
  return {
    ...provider,
    baseUrl,
    models: await discoverNvidiaModels({
      apiKey: params.discoveryApiKey,
      baseUrl,
      fallbackModels: provider.models,
    }),
    ...(params.apiKey ? { apiKey: params.apiKey } : {}),
  };
}
