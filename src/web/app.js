// Логіка веб-панелі: список агентів, створення через мета-агента, чат зі стрімінгом.

const $ = (sel) => document.querySelector(sel);
const state = { agents: [], activeId: null, personas: {} };

async function api(path, options) {
  const res = await fetch(path, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Помилка ${res.status}`);
  return data;
}

// --- Статус режиму ------------------------------------------------------
async function loadStatus() {
  try {
    const s = await api("/api/status");
    const el = $("#status");
    if (s.mock) {
      el.textContent = "⚠️ Мок-режим (без API-ключа)";
      el.className = "status mock";
    } else {
      el.textContent = `● Live · ${s.model}`;
      el.className = "status live";
    }
  } catch {
    $("#status").textContent = "офлайн";
  }
}

// --- Персони (для іконок) ----------------------------------------------
async function loadPersonas() {
  const list = await api("/api/personas");
  for (const p of list) state.personas[p.key] = p;
}

function emojiFor(personaKey) {
  return state.personas[personaKey]?.emoji ?? "🤖";
}

// --- Список агентів -----------------------------------------------------
async function loadAgents() {
  state.agents = await api("/api/agents");
  renderAgents();
}

function renderAgents() {
  const ul = $("#agents");
  $("#count").textContent = String(state.agents.length);
  ul.innerHTML = "";
  if (state.agents.length === 0) {
    ul.innerHTML = '<li class="hint">Ще немає агентів. Створи першого ↑</li>';
    return;
  }
  for (const a of state.agents) {
    const li = document.createElement("li");
    li.className = "agent-item" + (a.id === state.activeId ? " active" : "");
    li.onclick = () => selectAgent(a.id);
    li.innerHTML = `
      <div class="agent-title">${emojiFor(a.persona)} ${escapeHtml(a.name)}</div>
      <p class="agent-role">${escapeHtml(a.role || "—")}</p>
      <div class="agent-tags">${(a.tags || [])
        .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
        .join("")}</div>`;
    ul.appendChild(li);
  }
}

// --- Створення агента ---------------------------------------------------
async function spawn() {
  const instruction = $("#instruction").value.trim();
  if (!instruction) return;
  const btn = $("#spawn");
  btn.disabled = true;
  btn.textContent = "Проєктую…";
  try {
    const agent = await api("/api/agents/spawn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ instruction }),
    });
    $("#instruction").value = "";
    await loadAgents();
    selectAgent(agent.id);
  } catch (e) {
    alert("Не вдалося створити агента: " + e.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "✨ Спроєктувати й створити";
  }
}

// --- Вибір агента й чат -------------------------------------------------
function selectAgent(id) {
  state.activeId = id;
  renderAgents();
  const agent = state.agents.find((a) => a.id === id);
  if (!agent) return;

  const header = $("#chatHeader");
  header.className = "chat-header";
  header.innerHTML = `
    <button class="del" title="Видалити">✕ видалити</button>
    ${emojiFor(agent.persona)} ${escapeHtml(agent.name)}
    <div class="meta">${escapeHtml(agent.role || "")} · мета: ${escapeHtml(agent.goal || "")}</div>`;
  header.querySelector(".del").onclick = () => removeAgent(id);

  renderMessages(agent.conversation || []);
  $("#chatForm").hidden = false;
  $("#message").focus();
}

function renderMessages(conversation) {
  const box = $("#messages");
  box.innerHTML = "";
  if (conversation.length === 0) {
    box.innerHTML = '<div class="empty-msg">Почни розмову — напиши перше повідомлення.</div>';
    return;
  }
  for (const m of conversation) addBubble(m.role, m.content);
}

function addBubble(role, text) {
  const empty = $("#messages .empty-msg");
  if (empty) empty.remove();
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  $("#messages").appendChild(div);
  div.scrollIntoView({ block: "end" });
  return div;
}

// --- Надсилання повідомлення зі стрімінгом ------------------------------
function sendMessage(e) {
  e.preventDefault();
  const input = $("#message");
  const text = input.value.trim();
  const id = state.activeId;
  if (!text || !id) return;
  input.value = "";

  addBubble("user", text);
  const bubble = addBubble("assistant", "");
  let acc = "";

  const url = `/api/agents/${id}/stream?message=${encodeURIComponent(text)}`;
  const es = new EventSource(url);
  es.addEventListener("delta", (ev) => {
    acc += JSON.parse(ev.data).text;
    bubble.textContent = acc;
    bubble.scrollIntoView({ block: "end" });
  });
  es.addEventListener("done", () => {
    es.close();
    loadAgents();
  });
  es.addEventListener("error", (ev) => {
    es.close();
    if (!acc) bubble.textContent = "⚠️ Помилка зв'язку з агентом.";
  });
}

// --- Видалення ----------------------------------------------------------
async function removeAgent(id) {
  if (!confirm("Видалити цього агента?")) return;
  await api(`/api/agents/${id}`, { method: "DELETE" });
  if (state.activeId === id) {
    state.activeId = null;
    $("#chatForm").hidden = true;
    $("#messages").innerHTML = "";
    const header = $("#chatHeader");
    header.className = "chat-header empty";
    header.textContent = "Обери або створи агента ліворуч";
  }
  loadAgents();
}

function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

// --- Старт --------------------------------------------------------------
$("#spawn").onclick = spawn;
$("#chatForm").onsubmit = sendMessage;
(async () => {
  await loadStatus();
  await loadPersonas();
  await loadAgents();
})();
