export async function createNewSession() {
  const form = new FormData();

  form.append("name", "");
  form.append("endpoint_url", "https://chatgpt.com/backend-api/codex/responses");
  form.append("model", "gpt-5.5");
  form.append("rag", "false");
  form.append("skip_validation", "true");

  const res = await fetch("http://127.0.0.1:7000/api/session", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    throw new Error(
      `Session oluşturulamadı: ${res.status}\n${await res.text()}`
    );
  }

  const data = await res.json();
  return data.id;
}