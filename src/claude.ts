// Обгортка над Anthropic SDK з прозорим мок-режимом.
//
// Якщо є ANTHROPIC_API_KEY — викликаємо реальний Claude (адаптивне мислення,
// стрімінг для довгих відповідей). Якщо ключа немає — повертаємо детерміновані
// заглушки, щоб усю систему можна було запустити й потестувати без витрат на API.
//
// Помилки реального API (недійсний ключ, мережа, ліміти) не «валять» систему:
// проєктування агента відкочується на евристику, а чат показує зрозумілу причину.

import Anthropic from "@anthropic-ai/sdk";
import { ANTHROPIC_API_KEY, MAX_TOKENS, MOCK_MODE, MODEL_ID } from "./config.js";
import type { ChatMessage } from "./types.js";

export const isMock = MOCK_MODE;

const client = isMock ? null : new Anthropic({ apiKey: ANTHROPIC_API_KEY });

/** Перетворити нашу історію розмови у формат SDK. */
function toApiMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  return messages.map((m) => ({ role: m.role, content: m.content }));
}

/** Перетворити помилку API на зрозуміле україномовне повідомлення. */
export function describeError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) {
    return (
      "недійсний ключ ANTHROPIC_API_KEY (401). Перевір ключ у змінних середовища " +
      "або прибери його зовсім — тоді система працюватиме в демо-режимі."
    );
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return "ключ не має доступу до цієї моделі (403).";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "перевищено ліміт запитів до API (429). Спробуй трохи згодом.";
  }
  if (err instanceof Anthropic.APIError) {
    return `помилка Claude API (${err.status ?? "?"}): ${err.message}`;
  }
  return `несподівана помилка: ${(err as Error).message}`;
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
  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: opts.maxTokens ?? MAX_TOKENS,
      thinking: { type: "adaptive" },
      system: opts.system,
      messages: toApiMessages(opts.messages),
    });
    return textOf(response);
  } catch (err) {
    return `⚠️ Не вдалося отримати відповідь: ${describeError(err)}`;
  }
}

/**
 * Відповідь зі стрімінгом: кожен фрагмент тексту віддається через onDelta,
 * у кінці повертається повний текст. Стрімінг знімає ризик HTTP-таймауту на
 * довгих відповідях. Помилки API повертаються як текст, а не кидаються.
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

  try {
    const liveStream = client.messages.stream({
      model: MODEL_ID,
      max_tokens: opts.maxTokens ?? MAX_TOKENS,
      thinking: { type: "adaptive" },
      system: opts.system,
      messages: toApiMessages(opts.messages),
    });

    liveStream.on("text", (delta) => onDelta(delta));
    const finalMessage = await liveStream.finalMessage();
    return textOf(finalMessage);
  } catch (err) {
    const message = `⚠️ Не вдалося отримати відповідь: ${describeError(err)}`;
    onDelta(message);
    return message;
  }
}

/**
 * Структурований виклик: модель повертає JSON за заданою схемою.
 * Використовується мета-агентом для проєктування специфікації під-агента.
 * За будь-якої помилки (недійсний ключ, мережа, невалідний JSON) — фолбек,
 * щоб агент усе одно створився.
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
  try {
    const response = await client.messages.create({
      model: MODEL_ID,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userPrompt }],
      output_config: { format: { type: "json_schema", schema } },
    });
    return JSON.parse(textOf(response)) as T;
  } catch (err) {
    console.warn(`[metaAgent] фолбек на евристику: ${describeError(err)}`);
    return fallback();
  }
}

// --- Допоміжне ----------------------------------------------------------

/** Витягти суцільний текст із відповіді SDK. */
function textOf(message: Anthropic.Message): string {
  return message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

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
    `Щоб увімкнути справжній інтелект, задай дійсний ANTHROPIC_API_KEY.`;
  return Promise.resolve(reply);
}
