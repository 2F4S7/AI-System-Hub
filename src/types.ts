// Спільні типи для всієї системи мета-агента.

/** Роль повідомлення в розмові. */
export type Role = "user" | "assistant";

/** Одне повідомлення в історії розмови під-агента. */
export interface ChatMessage {
  role: Role;
  content: string;
  /** ISO-час створення. */
  at: string;
}

/**
 * Специфікація під-агента — те, що мета-агент проєктує перед створенням.
 * Це структурований "паспорт" агента: хто він, як мислить, яка його мета.
 */
export interface AgentSpec {
  /** Коротке людиночитане ім'я, напр. "Олена-Підприємниця". */
  name: string;
  /** Ключ персони (businessman, newsmaker, blogger, ...) або "custom". */
  persona: string;
  /** Одне речення про роль агента. */
  role: string;
  /** Системний промпт, що визначає поведінку агента. */
  systemPrompt: string;
  /** Стартова мета/завдання агента. */
  goal: string;
  /** Теги для пошуку/групування. */
  tags: string[];
}

/** Створений і керований мета-агентом під-агент. */
export interface Agent extends AgentSpec {
  id: string;
  createdAt: string;
  /** Хто створив агента: "meta" (мета-агент) або "user". */
  createdBy: "meta" | "user";
  conversation: ChatMessage[];
}

/** Шаблон персони, з якого мета-агент відштовхується. */
export interface PersonaTemplate {
  key: string;
  /** Людиночитана назва персони. */
  label: string;
  /** Емодзі-іконка для веб-панелі. */
  emoji: string;
  /** Короткий опис характеру персони. */
  description: string;
  /** Базовий системний промпт персони. */
  systemPrompt: string;
}
