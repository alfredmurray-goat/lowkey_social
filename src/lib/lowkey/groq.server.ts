export type GroqErrorCode = "missing_key" | "rate_limited" | "unauthorized" | "upstream_error";

export class GroqError extends Error {
  code: GroqErrorCode;
  status: number;
  constructor(code: GroqErrorCode, message: string, status = 500) {
    super(message);
    this.name = "GroqError";
    this.code = code;
    this.status = status;
  }
}

export type GroqMessageContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: GroqMessageContent;
}

export const GROQ_TEXT_MODEL = "llama-3.3-70b-versatile";
export const GROQ_VISION_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

export async function groqChatJson<T>(opts: {
  model?: string;
  messages: GroqMessage[];
  temperature?: number;
  maxTokens?: number;
}): Promise<T> {
  const apiKey = process.env["GROQ_API_KEY"];
  if (!apiKey) {
    throw new GroqError("missing_key", "GROQ_API_KEY is not configured", 500);
  }

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model ?? GROQ_TEXT_MODEL,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 512,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (res.status === 429) {
      throw new GroqError("rate_limited", body || "Groq rate limit reached", 429);
    }
    if (res.status === 401 || res.status === 403) {
      throw new GroqError("unauthorized", body || "Groq API key rejected", res.status);
    }
    throw new GroqError("upstream_error", body || `Groq HTTP ${res.status}`, res.status);
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string | null } }>;
  };
  const content = json.choices?.[0]?.message?.content?.trim() ?? "{}";
  return JSON.parse(content) as T;
}