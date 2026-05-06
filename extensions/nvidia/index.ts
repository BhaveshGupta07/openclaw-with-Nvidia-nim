import { defineSingleProviderPluginEntry } from "openclaw/plugin-sdk/provider-entry";
import { normalizeProviderId } from "openclaw/plugin-sdk/provider-model-shared";
import { normalizeOptionalString } from "openclaw/plugin-sdk/text-runtime";
import { applyNvidiaConfig, NVIDIA_DEFAULT_MODEL_REF } from "./onboard.js";
import { buildDiscoveredNvidiaProvider, buildNvidiaProvider } from "./provider-catalog.js";

const PROVIDER_ID = "nvidia";

function buildNvidiaCatalogModels() {
  return buildNvidiaProvider().models.map((model) => ({
    provider: PROVIDER_ID,
    id: model.id,
    name: model.name ?? model.id,
    contextWindow: model.contextWindow,
    reasoning: model.reasoning,
    input: model.input,
  }));
}

export default defineSingleProviderPluginEntry({
  id: PROVIDER_ID,
  name: "NVIDIA Provider",
  description: "Bundled NVIDIA provider plugin",
  provider: {
    label: "NVIDIA",
    docsPath: "/providers/nvidia",
    envVars: ["NVIDIA_API_KEY"],
    preserveLiteralProviderPrefix: true,
    auth: [
      {
        methodId: "api-key",
        label: "NVIDIA API key",
        hint: "Direct API key",
        optionKey: "nvidiaApiKey",
        flagName: "--nvidia-api-key",
        envVar: "NVIDIA_API_KEY",
        promptMessage: "Enter NVIDIA API key",
        defaultModel: NVIDIA_DEFAULT_MODEL_REF,
        applyConfig: applyNvidiaConfig,
      },
    ],
    catalog: {
      run: async (ctx) => {
        const auth = ctx.resolveProviderApiKey(PROVIDER_ID);
        if (!auth.apiKey) {
          return null;
        }
        const configuredProvider = Object.entries(ctx.config.models?.providers ?? {}).find(
          ([providerId]) => normalizeProviderId(providerId) === PROVIDER_ID,
        )?.[1];
        return {
          provider: await buildDiscoveredNvidiaProvider({
            apiKey: auth.apiKey,
            discoveryApiKey: auth.discoveryApiKey,
            baseUrl: normalizeOptionalString(configuredProvider?.baseUrl),
          }),
        };
      },
      staticRun: async () => ({
        provider: buildNvidiaProvider(),
      }),
    },
    augmentModelCatalog: buildNvidiaCatalogModels,
    wizard: {
      setup: {
        choiceId: "nvidia-api-key",
        choiceLabel: "NVIDIA API key",
        groupId: "nvidia",
        groupLabel: "NVIDIA",
        groupHint: "Direct API key",
        methodId: "api-key",
        modelSelection: {
          promptWhenAuthChoiceProvided: true,
          allowKeepCurrent: false,
        },
      },
      modelPicker: {
        label: "NVIDIA (custom)",
        hint: "Use NVIDIA-hosted open models",
        methodId: "api-key",
      },
    },
  },
});
