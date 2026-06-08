// Конфігурація середовища: модель, порт, режим роботи (реальний API чи мок).

/** ID моделі Claude за замовчуванням — найпотужніша наявна. */
export const MODEL_ID = process.env.AI_HUB_MODEL ?? "claude-opus-4-8";

/** Порт веб-сервера. */
export const PORT = Number(process.env.PORT ?? 4317);

/** Ключ Anthropic API (необов'язковий — без нього система працює в мок-режимі). */
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

/**
 * Чи працюємо на заглушках. Мок-режим вмикається автоматично, якщо немає ключа,
 * або примусово через AI_HUB_MOCK=1 (зручно для демонстрацій без витрат на API).
 */
export const MOCK_MODE = !ANTHROPIC_API_KEY || process.env.AI_HUB_MOCK === "1";

/** Скільки токенів максимум на одну відповідь (стрімінг дозволяє брати з запасом). */
export const MAX_TOKENS = Number(process.env.AI_HUB_MAX_TOKENS ?? 4096);
