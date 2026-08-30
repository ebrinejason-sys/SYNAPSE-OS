export const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

/** OpenRouter allows 1 primary model + up to 3 entries in the `models` fallback array. */
export const OPENROUTER_MAX_MODELS = 4;

/** Free models that reliably return structured JSON for the clinical demo. */
export const DEFAULT_OPENROUTER_FREE_MODELS = [
  "google/gemma-4-31b-it:free",
  "google/gemma-4-26b-a4b-it:free",
  "openrouter/free",
  "minimax/minimax-m2.7:free",
] as const;

export type OpenRouterChatSuccess = {
  content: string;
  model: string;
};

export type OpenRouterChatFailure = {
  ok: false;
  status: number;
  message: string;
};

export type OpenRouterChatResult =
  | ({ ok: true } & OpenRouterChatSuccess)
  | OpenRouterChatFailure;

function uniqueModels(models: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const model of models) {
    const id = model.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function resolveOpenRouterModels(env: NodeJS.Dict<string> = process.env): string[] {
  const pinned = env.OPENROUTER_MODEL?.trim();
  const extra = (env.OPENROUTER_FALLBACK_MODELS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return uniqueModels([
    ...(pinned ? [pinned] : []),
    ...DEFAULT_OPENROUTER_FREE_MODELS,
    ...extra,
  ]);
}

export function isOpenRouterConfigured(env: NodeJS.Dict<string> = process.env): boolean {
  return Boolean(env.OPENROUTER_API_KEY?.trim());
}

type OpenRouterMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenRouterChoice = {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
    reasoning?: string;
  };
};

function choiceContent(json: { choices?: OpenRouterChoice[]; model?: string }): string {
  const message = json.choices?.[0]?.message;
  if (!message) return "";

  let content = "";
  const rawContent = message.content;
  if (typeof rawContent === "string") {
    content = rawContent;
  } else if (Array.isArray(rawContent)) {
    content = rawContent.map((part) => (typeof part?.text === "string" ? part.text : "")).join("");
  }

  const reasoning = typeof message.reasoning === "string" ? message.reasoning : "";
  // Free reasoning models often leave `content` empty and put the answer in `reasoning`.
  return (content.trim() || reasoning.trim());
}

export async function completeOpenRouterChat(options: {
  apiKey: string;
  messages: OpenRouterMessage[];
  models: string[];
  referer?: string;
  title?: string;
  temperature?: number;
  jsonMode?: boolean;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<OpenRouterChatResult> {
  const models = uniqueModels(options.models).slice(0, OPENROUTER_MAX_MODELS);
  if (models.length === 0) {
    return { ok: false, status: 400, message: "no OpenRouter models configured" };
  }

  const [primary, ...fallbacks] = models;
  const fetchImpl = options.fetchImpl ?? fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);

  try {
    const res = await fetchImpl(OPENROUTER_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": options.referer ?? "https://synapseos.tech",
        "X-Title": options.title ?? "Synapse OS Clinical AI",
      },
      body: JSON.stringify({
        model: primary,
        ...(fallbacks.length ? { models: fallbacks } : {}),
        messages: options.messages,
        temperature: options.temperature ?? 0.2,
        ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
      }),
      signal: controller.signal,
    });

    const raw = await res.text();
    if (!res.ok) {
      let message = raw.slice(0, 280);
      try {
        const parsed = JSON.parse(raw) as { error?: { message?: string } };
        if (parsed.error?.message) message = parsed.error.message;
      } catch {
        // keep truncated raw body
      }
      return { ok: false, status: res.status, message };
    }

    const json = JSON.parse(raw) as { choices?: OpenRouterChoice[]; model?: string };
    const content = choiceContent(json).trim();
    if (!content) {
      return { ok: false, status: 502, message: "OpenRouter returned an empty completion" };
    }

    return {
      ok: true,
      content,
      model: json.model ?? primary ?? "openrouter",
    };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return {
      ok: false,
      status: aborted ? 504 : 502,
      message: aborted ? "OpenRouter request timed out" : error instanceof Error ? error.message : "OpenRouter request failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function publicOpenRouterError(failure: OpenRouterChatFailure): string {
  if (failure.status === 401 || failure.status === 403) {
    return "OpenRouter API key was rejected. Check OPENROUTER_API_KEY.";
  }
  if (failure.status === 402) {
    return "OpenRouter has no remaining credits for this key. Use a free model id (openrouter/free) or add credits.";
  }
  if (failure.status === 429) {
    return "Free-model rate limit reached. Wait a minute and try again.";
  }
  if (failure.status === 504) {
    return "Clinical AI timed out. Please try again.";
  }
  if (failure.message) {
    return failure.message;
  }
  return "OpenRouter did not return a usable response.";
}
