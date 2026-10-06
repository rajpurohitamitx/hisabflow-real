export type OllamaMessage = { role: "system" | "user" | "assistant"; content: string };

function baseUrl() {
  return (process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434").replace(/\/$/, "");
}

function model() {
  return process.env.OLLAMA_MODEL || "qwen2.5:3b";
}

export function isLocalAIEnabled() {
  return (process.env.AI_PROVIDER || "deterministic").toLowerCase() === "ollama";
}

export async function ollamaJson(messages: OllamaMessage[], timeoutMs = 60000): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${baseUrl()}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: model(),
        messages,
        stream: false,
        format: "json",
        options: { temperature: 0.1 },
      }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Ollama returned ${response.status}. Is Ollama running?`);
    const data = await response.json();
    return JSON.parse(data.message?.content || "{}");
  } finally {
    clearTimeout(timer);
  }
}
