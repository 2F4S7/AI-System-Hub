// Обгортка над Anthropic SDK з прозорим мок-режимом.
//
// Якщо є ANTHROPIC_API_KEY — викликаємо реальний Claude (адаптивне мислення,
// стрімінг для довгих відповідей). Якщо ключа немає — повертаємо детерміновані
// заглушки, щоб усю систему можна було запустити й потестувати без витрат на API.

import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, MAX_TOKENS, MOCK_MODE, MODEL_ID } from "./config.js";
import type { ChatMessage } from "./types.js";

export const isMock = MOCK_MODE;

const client = isMock ? null : new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/** Перетворити нашу історію розмови у формат SDK. */
function toApiMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

export interface GenerateOptions {
  system: string;
  messages: ChatMessage[];
  maxTokens?: number;
}

/** Одна відповідь без стрімінгу (зручно для коротких внутрішніх викликів). */
export async function generate(opts: GenerateOptions): Promise<string> {
  if (isMock || !client) {
    return mockReply(opts.system, opts.messages);
  }
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: opts.maxTokens ?? MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: toApiMessages(opts.messages),
  });
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Відповідь зі стрімінгом: кожен фрагмент тексту віддається через onDelta,
 * у кінці повертається повний текст. Стрімінг знімає ризик HTTP-таймауту на
 * довгих відповідях.
 */
export async function stream(
  opts: GenerateOptions,
  onDelta: (text: string) => void,
): Promise<string> {
  if (isMock || !client) {
    const full = await mockReply(opts.system, opts.messages);
    // Імітуємо стрімінг по словах, щоб веб-панель поводилась однаково.
    for (const chunk of full.match(/\S+\s*/g) ?? [full]) {
      onDelta(chunk);
      await sleep(12);
    }
    return full;
  }

  const liveStream = client.messages.stream({
    model: MODEL_ID,
    max_tokens: opts.maxTokens ?? MAX_TOKENS,
    thinking: { type: "adaptive" },
    system: opts.system,
    messages: toApiMessages(opts.messages),
  });

  liveStream.on("text", (delta) => onDelta(delta));
  const finalMessage = await liveStream.finalMessage();
  return finalMessage.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Структурований виклик: модель повертає JSON за заданою схемою.
 * Використовується мета-агентом для проєктування специфікації під-агента.
 */
export async function generateJSON<T>(
  system: string,
  userPrompt: string,
  schema: Record<string, unknown>,
  fallback: () => T,
): Promise<T> {
  if (isMock || !client) {
    return fallback();
  }
  const response = await client.messages.create({
    model: MODEL_ID,
    max_tokens: MAX_TOKENS,
    system,
    messages: [{ role: "user", content: userPrompt }],
    output_config: { format: { type: "json_schema", schema } },
  });
  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback();
  }
}

// --- Мок-режим ----------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Детермінована заглушка відповіді — без мережі та без витрат на API. */
function mockReply(system: string, messages: ChatMessage[]): Promise<string> {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const persona = system.split(".")[0]?.trim() || "Агент";
  const question = lastUser?.content.trim() || "(без запиту)";
  const reply =
    `«${persona}» (демо-режим без API-ключа).\n\n` +
    `Я отримав запит: «${question}».\n\n` +
    `У реальному режимі тут була б відповідь Claude, сформована згідно з моєю персоною. ` +
    `Щоб увімкнути справжній інтелект, задай змінну середовища ANTHROPIC_API_KEY.`;
  return Promise.resolve(reply);
}
