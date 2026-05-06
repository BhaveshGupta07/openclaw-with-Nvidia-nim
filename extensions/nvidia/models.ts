import type { ModelDefinitionConfig } from "openclaw/plugin-sdk/provider-model-shared";
import { createSubsystemLogger } from "openclaw/plugin-sdk/runtime-env";
import {
  fetchWithSsrFGuard,
  ssrfPolicyFromHttpBaseUrlAllowedHostname,
} from "openclaw/plugin-sdk/ssrf-runtime";
import { normalizeOptionalString } from "openclaw/plugin-sdk/text-runtime";

const log = createSubsystemLogger("nvidia-models");

const NVIDIA_DEFAULT_MAX_TOKENS = 8192;
const NVIDIA_DEFAULT_COST = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheWrite: 0,
} as const;

export type NvidiaModelsResponse = {
  data?: Array<{
    id?: unknown;
    root?: unknown;
    max_model_len?: unknown;
  }>;
};

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function resolveNvidiaModelId(entry: { id?: unknown; root?: unknown }): string {
  return normalizeOptionalString(entry.id) ?? normalizeOptionalString(entry.root) ?? "";
}

function resolveContextWindow(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined;
}

export function buildNvidiaModelDefinitionsFromResponse(
  response: NvidiaModelsResponse,
  fallbackModels: readonly ModelDefinitionConfig[],
): ModelDefinitionConfig[] {
  const fallbackById = new Map(fallbackModels.map((model) => [model.id, model]));
  const seen = new Set<string>();
  const models: ModelDefinitionConfig[] = [];

  for (const entry of response.data ?? []) {
    const id = resolveNvidiaModelId(entry);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const fallback = fallbackById.get(id);
    models.push({
      id,
      name: fallback?.name ?? id,
      reasoning: fallback?.reasoning ?? false,
      input: fallback?.input ?? ["text"],
      contextWindow: resolveContextWindow(entry.max_model_len) ?? fallback?.contextWindow ?? 131072,
      maxTokens: fallback?.maxTokens ?? NVIDIA_DEFAULT_MAX_TOKENS,
      cost: fallback?.cost ?? NVIDIA_DEFAULT_COST,
      compat: fallback?.compat ?? { requiresStringContent: true },
    });
  }

  return models;
}

export async function discoverNvidiaModels(params: {
  apiKey?: string;
  baseUrl: string;
  fallbackModels: readonly ModelDefinitionConfig[];
}): Promise<ModelDefinitionConfig[]> {
  const baseUrl = normalizeBaseUrl(params.baseUrl);
  const apiKey = normalizeOptionalString(params.apiKey);
  const fallback = () => [...params.fallbackModels];

  if (!apiKey) {
    return fallback();
  }
  if (process.env.VITEST || process.env.NODE_ENV === "test") {
    return fallback();
  }

  try {
    const { response, release } = await fetchWithSsrFGuard({
      url: `${baseUrl}/models`,
      init: {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      },
      policy: ssrfPolicyFromHttpBaseUrlAllowedHostname(baseUrl),
      auditContext: "nvidia-model-discovery",
    });
    try {
      if (!response.ok) {
        log.warn(`GET /v1/models failed: HTTP ${response.status}, using static catalog`);
        return fallback();
      }
      const payload = (await response.json()) as NvidiaModelsResponse;
      const discovered = buildNvidiaModelDefinitionsFromResponse(payload, params.fallbackModels);
      return discovered.length > 0 ? discovered : fallback();
    } finally {
      await release();
    }
  } catch (error) {
    log.warn(`GET /v1/models failed: ${String(error)}, using static catalog`);
    return fallback();
  }
}
