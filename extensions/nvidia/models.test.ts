import { describe, expect, it } from "vitest";
import { buildNvidiaModelDefinitionsFromResponse } from "./models.js";
import { buildNvidiaProvider } from "./provider-catalog.js";

describe("nvidia model discovery", () => {
  it("builds model definitions from NVIDIA /v1/models responses", () => {
    const models = buildNvidiaModelDefinitionsFromResponse(
      {
        data: [
          {
            id: "nvidia/nemotron-3-super-120b-a12b",
            max_model_len: 262144,
          },
          {
            id: "meta/llama-3.3-70b-instruct",
            max_model_len: 131072,
          },
          {
            id: "meta/llama-3.3-70b-instruct",
            max_model_len: 131072,
          },
          {
            root: "mistralai/mistral-small-24b-instruct",
            max_model_len: 32768,
          },
        ],
      },
      buildNvidiaProvider().models,
    );

    expect(models.map((model) => model.id)).toEqual([
      "nvidia/nemotron-3-super-120b-a12b",
      "meta/llama-3.3-70b-instruct",
      "mistralai/mistral-small-24b-instruct",
    ]);
    expect(models[0]).toMatchObject({
      name: "NVIDIA Nemotron 3 Super 120B",
      contextWindow: 262144,
      maxTokens: 8192,
      compat: { requiresStringContent: true },
    });
    expect(models[1]).toMatchObject({
      name: "meta/llama-3.3-70b-instruct",
      contextWindow: 131072,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    });
  });
});
