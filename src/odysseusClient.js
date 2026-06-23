import {
  DEFAULT_ENDPOINT_URL,
  DEFAULT_MODEL,
  ODYSSEUS_BASE_URL
} from "./config.js";

export async function createSession() {
  const form = new FormData();

  form.append("name", "");
  form.append("endpoint_url", DEFAULT_ENDPOINT_URL);
  form.append("model", DEFAULT_MODEL);
  form.append("rag", "false");
  form.append("skip_validation", "true");

  const response = await fetch(`${ODYSSEUS_BASE_URL}/api/session`, {
    method: "POST",
    body: form
  });

  if (!response.ok) {
    throw new Error(
      `Session olusturulamadi: ${response.status}\n${await response.text()}`
    );
  }

  const data = await response.json();
  return data.id;
}

export async function askOdysseus(sessionId, message) {
  const response = await fetch(`${ODYSSEUS_BASE_URL}/api/chat_stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message,
      session: sessionId,
      mode: "chat",
      use_rag: false
    })
  });

  if (!response.ok) {
    throw new Error(
      `Mesaj gonderilemedi: ${response.status}\n${await response.text()}`
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let answer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });

    for (const line of chunk.split("\n")) {
      if (!line.startsWith("data: ")) continue;

      const raw = line.replace("data: ", "").trim();

      if (raw === "[DONE]") {
        return answer;
      }

      try {
        const json = JSON.parse(raw);

        if (json.delta) {
          answer += json.delta;
        }
      } catch {
        // Odysseus stream bazen tamamlanmamis satirlar dondurebilir.
      }
    }
  }

  return answer;
}
