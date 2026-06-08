// Логіка під-агента: він відповідає в межах своєї персони, пам'ятаючи розмову.

import { generate, stream } from "./claude.js";
import { appendMessage, getAgent } from "./store.js";
import type { Agent } from "./types.js";

/** Зібрати повний системний промпт агента (персона + мета). */
function buildSystem(agent: Agent): string {
  return (
    `${agent.systemPrompt}\n\n` +
    `Твоя роль: ${agent.role}.\n` +
    `Твоя поточна мета: ${agent.goal}.\n` +
    `Лишайся в образі та відповідай українською мовою.`
  );
}

/** Дати під-агенту завдання й отримати відповідь (без стрімінгу). */
export async function ask(agentId: string, userText: string): Promise<string> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error("Агента не знайдено");

  appendMessage(agentId, "user", userText);
  const reply = await generate({
    system: buildSystem(agent),
    messages: agent.conversation,
  });
  appendMessage(agentId, "assistant", reply);
  return reply;
}

/** Те саме, але зі стрімінгом фрагментів через onDelta. */
export async function askStream(
  agentId: string,
  userText: string,
  onDelta: (text: string) => void,
): Promise<string> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error("Агента не знайдено");

  appendMessage(agentId, "user", userText);
  const reply = await stream(
    { system: buildSystem(agent), messages: agent.conversation },
    onDelta,
  );
  appendMessage(agentId, "assistant", reply);
  return reply;
}
