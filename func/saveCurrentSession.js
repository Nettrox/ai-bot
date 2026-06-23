import fs from "fs/promises";

async function getSessionTitle(sessionId) {
  const res = await fetch("http://127.0.0.1:7000/api/sessions");

  if (!res.ok) {
    throw new Error(`Session listesi alınamadı: ${res.status}\n${await res.text()}`);
  }

  const sessions = await res.json();
  const session = sessions.find(s => s.id === sessionId);

  if (!session) {
    return "Başlık bulunamadı";
  }

  return session.name || "Başlıksız Sohbet";
}

async function saveSessionToJson(sessionId, title) {
  let sessions = [];

  try {
    const file = await fs.readFile("session_ids.json", "utf8");
    sessions = JSON.parse(file);
  } catch {
    sessions = [];
  }

  const exists = sessions.some(s => s.session_id === sessionId);

  if (!exists) {
    const nextIndex =
      sessions.length > 0
        ? Math.max(...sessions.map(s => s.index || 0)) + 1
        : 1;

    sessions.push({
      index: nextIndex,
      session_id: sessionId,
      title,
    });
  }

  await fs.writeFile(
    "session_ids.json",
    JSON.stringify(sessions, null, 2),
    "utf8"
  );
}

export async function saveCurrentSession(sessionId) {
  const title = await getSessionTitle(sessionId);
  await saveSessionToJson(sessionId, title);
}