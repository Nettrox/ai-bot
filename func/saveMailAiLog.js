import fs from "fs/promises";

const FILE_PATH = "mail_ai.log";

export async function saveMailAiLog(type, data) {
  const line = JSON.stringify(
    {
      created_at: new Date().toISOString(),
      type,
      data,
    },
    null,
    2
  );

  await fs.appendFile(FILE_PATH, `${line}\n\n`, "utf8");
}
