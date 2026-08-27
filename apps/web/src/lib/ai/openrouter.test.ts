import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  completeOpenRouterChat,
  publicOpenRouterError,
  resolveOpenRouterModels,
} from "./openrouter.ts";

describe("resolveOpenRouterModels", () => {
  it("defaults to the free router first", () => {
    const models = resolveOpenRouterModels({});
    assert.equal(models[0], "openrouter/free");
    assert.ok(models.every((model) => model.includes("/") && !model.includes("deepseek-r1-distill-llama-70b")));
  });

  it("pins OPENROUTER_MODEL ahead of defaults without duplicates", () => {
    const models = resolveOpenRouterModels({
      OPENROUTER_MODEL: "google/gemma-4-31b-it:free",
      OPENROUTER_FALLBACK_MODELS: "openrouter/free, google/gemma-4-31b-it:free",
    });
    assert.equal(models[0], "google/gemma-4-31b-it:free");
    assert.equal(models.filter((model) => model === "google/gemma-4-31b-it:free").length, 1);
  });
});

describe("completeOpenRouterChat", () => {
  it("sends the free-model fallback list and parses content", async () => {
    let captured: { url?: string; body?: Record<string, unknown>; headers?: HeadersInit } = {};
    const result = await completeOpenRouterChat({
      apiKey: "sk-or-test",
      messages: [{ role: "user", content: "hello" }],
      models: ["openrouter/free", "google/gemma-4-31b-it:free"],
      jsonMode: true,
      fetchImpl: async (url, init) => {
        captured = {
          url: String(url),
          body: JSON.parse(String(init?.body)),
          headers: init?.headers,
        };
        return new Response(
          JSON.stringify({
            model: "google/gemma-4-31b-it:free",
            choices: [{ message: { content: "{\"ok\":true}" } }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      },
    });

    assert.equal(result.ok, true);
    if (!result.ok) return;
    assert.equal(result.model, "google/gemma-4-31b-it:free");
    assert.equal(result.content, "{\"ok\":true}");
    assert.equal(captured.url, "https://openrouter.ai/api/v1/chat/completions");
    assert.equal(captured.body?.model, "openrouter/free");
    assert.deepEqual(captured.body?.models, ["google/gemma-4-31b-it:free"]);
    assert.deepEqual(captured.body?.response_format, { type: "json_object" });
  });

  it("surfaces OpenRouter error messages", async () => {
    const result = await completeOpenRouterChat({
      apiKey: "sk-or-test",
      messages: [{ role: "user", content: "hello" }],
      models: ["deepseek/deepseek-r1-distill-llama-70b"],
      fetchImpl: async () =>
        new Response(JSON.stringify({ error: { message: "Payment required" } }), { status: 402 }),
    });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.status, 402);
    assert.equal(publicOpenRouterError(result).includes("credits"), true);
  });
});
