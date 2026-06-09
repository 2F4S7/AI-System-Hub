// Завантажувач .env без зовнішніх залежностей.
//
// Якщо в корені проєкту є файл .env — підхоплюємо з нього змінні в process.env.
// Реальні змінні середовища (та Codespaces Secrets) мають пріоритет: вже задані
// ключі ми не перезаписуємо. Імпортуй цей модуль НАЙПЕРШИМ — до config.ts,
// бо config читає process.env одразу під час завантаження.

import { readFileSync } from "node:fs";
import { join } from "node:path";

function loadEnv(): void {
  const path = join(process.cwd(), ".env");
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch {
    return; // .env немає — це нормально (наприклад, у мок-режимі)
  }

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();

    // Прибираємо обрамлювальні лапки, якщо є.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv();
