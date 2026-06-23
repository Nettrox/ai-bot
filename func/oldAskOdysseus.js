export async function oldAskOdysseus(sessionId, question) {
  const response = await fetch("http://127.0.0.1:7000/api/chat_stream", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: question,
      session: sessionId,
      mode: "chat",
      use_rag: false
    })
  });

  if (!response.ok) {
    throw new Error(`Mesaj gönderilemedi: ${response.status}\n${await response.text()}`);
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
          process.stdout.write(json.delta);
        }
      } catch {}
    }
  }

  return answer;
}