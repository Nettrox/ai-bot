import fs from "fs/promises";

export async function getLatestSessionId() {
  const file = await fs.readFile("session_ids.json", "utf8");
  const sessions = JSON.parse(file);

  if (sessions.length === 0) {
    throw new Error("Kayıtlı session yok");
  }

  const latest = sessions.reduce((max, current) =>
    current.index > max.index ? current : max
  );

  return latest.session_id;
}