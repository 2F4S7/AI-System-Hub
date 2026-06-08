// HTTP-сервер: REST API для керування агентами + статична веб-панель + SSE-стрімінг.
// Без зовнішніх веб-фреймворків — лише вбудований модуль node:http.

import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { isMock } from "./claude.js";
import { MODEL_ID, PORT } from "./config.js";
import { spawnAgent } from "./metaAgent.js";
import { PERSONAS } from "./personas.js";
import {
  createAgent,
  deleteAgent,
  getAgent,
  listAgents,
} from "./store.js";
import { askStream } from "./subAgent.js";
import type { AgentSpec } from "./types.js";

const WEB_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "web");

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function sendJSON(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(payload);
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
  } catch {
    return {};
  }
}

/** Віддати статичний файл веб-панелі (із захистом від виходу за межі теки). */
async function serveStatic(res: ServerResponse, urlPath: string): Promise<void> {
  const rel = urlPath === "/" ? "/index.html" : urlPath;
  const safe = normalize(rel).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(WEB_DIR, safe);
  if (!filePath.startsWith(WEB_DIR)) {
    sendJSON(res, 403, { error: "Заборонено" });
    return;
  }
  try {
    const info = await stat(filePath);
    if (!info.isFile()) throw new Error("not a file");
    res.writeHead(200, {
      "Content-Type": MIME[extname(filePath)] ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(res);
  } catch {
    sendJSON(res, 404, { error: "Не знайдено" });
  }
}

/** Обробити SSE-стрімінг відповіді під-агента. */
async function handleStream(
  res: ServerResponse,
  agentId: string,
  message: string,
): Promise<void> {
  if (!getAgent(agentId)) {
    sendJSON(res, 404, { error: "Агента не знайдено" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  const sse = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
  try {
    await askStream(agentId, message, (delta) => sse("delta", { text: delta }));
    sse("done", { ok: true });
  } catch (err) {
    sse("error", { message: (err as Error).message });
  }
  res.end();
}

const server = createServer(async (req, res) => {
  const method = req.method ?? "GET";
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const path = url.pathname;

  try {
    // --- API ---
    if (path === "/api/status" && method === "GET") {
      return sendJSON(res, 200, { mock: isMock, model: MODEL_ID });
    }

    if (path === "/api/personas" && method === "GET") {
      return sendJSON(res, 200, PERSONAS);
    }

    if (path === "/api/agents" && method === "GET") {
      return sendJSON(res, 200, listAgents());
    }

    if (path === "/api/agents/spawn" && method === "POST") {
      const body = (await readBody(req)) as { instruction?: string };
      const instruction = (body.instruction ?? "").trim();
      if (!instruction) {
        return sendJSON(res, 400, { error: "Потрібна інструкція" });
      }
      const agent = await spawnAgent(instruction);
      return sendJSON(res, 201, agent);
    }

    if (path === "/api/agents" && method === "POST") {
      const spec = (await readBody(req)) as Partial<AgentSpec>;
      if (!spec.name || !spec.systemPrompt) {
        return sendJSON(res, 400, { error: "Потрібні щонайменше name і systemPrompt" });
      }
      const agent = createAgent(
        {
          name: spec.name,
          persona: spec.persona ?? "custom",
          role: spec.role ?? "",
          systemPrompt: spec.systemPrompt,
          goal: spec.goal ?? "",
          tags: spec.tags ?? [],
        },
        "user",
      );
      return sendJSON(res, 201, agent);
    }

    // /api/agents/:id ...
    const agentMatch = path.match(/^\/api\/agents\/([^/]+)(\/[^/]+)?$/);
    if (agentMatch) {
      const id = agentMatch[1]!;
      const sub = agentMatch[2];

      if (!sub && method === "GET") {
        const agent = getAgent(id);
        return agent
          ? sendJSON(res, 200, agent)
          : sendJSON(res, 404, { error: "Агента не знайдено" });
      }

      if (!sub && method === "DELETE") {
        return deleteAgent(id)
          ? sendJSON(res, 200, { ok: true })
          : sendJSON(res, 404, { error: "Агента не знайдено" });
      }

      if (sub === "/stream" && method === "GET") {
        const message = (url.searchParams.get("message") ?? "").trim();
        if (!message) return sendJSON(res, 400, { error: "Потрібне повідомлення" });
        return handleStream(res, id, message);
      }
    }

    // --- Статика ---
    if (method === "GET" && !path.startsWith("/api/")) {
      return serveStatic(res, path);
    }

    sendJSON(res, 404, { error: "Маршрут не знайдено" });
  } catch (err) {
    sendJSON(res, 500, { error: (err as Error).message });
  }
});

export function startServer(): void {
  server.listen(PORT, () => {
    const mode = isMock ? "МОК-РЕЖИМ (без API-ключа)" : `реальний API (${MODEL_ID})`;
    console.log(`AI-System-Hub запущено: http://localhost:${PORT}`);
    console.log(`Режим: ${mode}`);
  });
}
