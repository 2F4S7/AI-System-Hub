// Мета-агент (оркестратор / «директор»).
//
// Отримує високорівневу інструкцію людини ("створи блогера, що веде канал про
// подорожі") і проєктує специфікацію під-агента: ім'я, персону, роль, системний
// промпт і мету. У реальному режимі проєктування робить сам Claude (структурований
// вихід за JSON-схемою). У мок-режимі застосовуються евристики на основі персон.

import { generateJSON, isMock } from "./claude.js";
import { findPersona, PERSONAS } from "./personas.js";
import { createAgent } from "./store.js";
import type { Agent, AgentSpec } from "./types.js";

const META_SYSTEM =
  "Ти — мета-агент, що проєктує спеціалізованих під-агентів зі штучним інтелектом. " +
  "За інструкцією людини ти створюєш паспорт нового агента. Обери одну з персон " +
  `(${PERSONAS.map((p) => p.key).join(", ")}) або 'custom'. ` +
  "Сформулюй сильний, конкретний системний промпт і чітку мету. Усі текстові поля — " +
  "українською мовою. Поверни лише JSON за заданою схемою.";

// JSON-схема специфікації під-агента для структурованого виходу.
const SPEC_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    name: { type: "string" },
    persona: {
      type: "string",
      enum: [...PERSONAS.map((p) => p.key), "custom"],
    },
    role: { type: "string" },
    systemPrompt: { type: "string" },
    goal: { type: "string" },
    tags: { type: "array", items: { type: "string" } },
  },
  required: ["name", "persona", "role", "systemPrompt", "goal", "tags"],
  additionalProperties: false,
};

/** Спроєктувати специфікацію під-агента з інструкції людини. */
export async function designSpec(instruction: string): Promise<AgentSpec> {
  return generateJSON<AgentSpec>(
    META_SYSTEM,
    `Інструкція: ${instruction}\n\nСпроєктуй паспорт під-агента.`,
    SPEC_SCHEMA,
    () => heuristicSpec(instruction),
  );
}

/** Спроєктувати й одразу створити під-агента. */
export async function spawnAgent(instruction: string): Promise<Agent> {
  const spec = await designSpec(instruction);
  return createAgent(spec, "meta");
}

// --- Евристичний фолбек (мок-режим або збій парсингу) -------------------

/** Підібрати персону за ключовими словами в інструкції. */
function pickPersona(instruction: string): string {
  const text = instruction.toLowerCase();
  const rules: Array<[string, string[]]> = [
    ["businessman", ["бізнес", "стартап", "підприєм", "прода", "гроші", "монетиз"]],
    ["newsmaker", ["новин", "ньюс", "преса", "заголов", "інфопривід", "медіа"]],
    ["blogger", ["блог", "контент", "канал", "ютуб", "інстаграм", "аудитор", "подорож"]],
    ["analyst", ["аналіт", "аналіз", "дані", "статист", "досліджен", "звіт", "метрик"]],
    ["creative", ["креатив", "ідея", "ідеї", "дизайн", "концеп", "бренд", "нейм"]],
  ];
  for (const [key, words] of rules) {
    if (words.some((w) => text.includes(w))) return key;
  }
  return "creative";
}

/** Зібрати специфікацію без виклику моделі. */
function heuristicSpec(instruction: string): AgentSpec {
  const personaKey = pickPersona(instruction);
  const persona = findPersona(personaKey) ?? PERSONAS[PERSONAS.length - 1]!;
  const shortGoal = instruction.trim().replace(/\s+/g, " ").slice(0, 160);
  return {
    name: `${persona.label} #${Math.floor(Math.random() * 900 + 100)}`,
    persona: persona.key,
    role: `${persona.label}, створений під завдання: ${shortGoal || "вільна тема"}`,
    systemPrompt: persona.systemPrompt,
    goal: shortGoal || "Допомагати користувачу в межах своєї персони.",
    tags: [persona.key, isMock ? "demo" : "auto"],
  };
}
