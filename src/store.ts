// Просте in-memory сховище агентів та їхніх розмов.
// Дані живуть у пам'яті процесу — для каркаса цього достатньо; пізніше легко
// замінити на БД, не змінюючи інтерфейс.

import { randomUUID } from "node:crypto";
import type { Agent, AgentSpec, ChatMessage, Role } from "./types.js";

const agents = new Map<string, Agent>();

/** Створити агента зі специфікації. */
export function createAgent(
  spec: AgentSpec,
  createdBy: "meta" | "user",
): Agent {
  const agent: Agent = {
    ...spec,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    createdBy,
    conversation: [],
  };
  agents.set(agent.id, agent);
  return agent;
}

/** Усі агенти, найновіші зверху. */
export function listAgents(): Agent[] {
  return [...agents.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

export function getAgent(id: string): Agent | undefined {
  return agents.get(id);
}

export function deleteAgent(id: string): boolean {
  return agents.delete(id);
}

/** Додати повідомлення в історію агента. */
export function appendMessage(
  id: string,
  role: Role,
  content: string,
): ChatMessage | undefined {
  const agent = agents.get(id);
  if (!agent) return undefined;
  const message: ChatMessage = {
    role,
    content,
    at: new Date().toISOString(),
  };
  agent.conversation.push(message);
  return message;
}
