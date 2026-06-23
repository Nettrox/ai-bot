import fs from "fs/promises";
import path from "path";
import { fileExists } from "./utils.js";

const PROJECT_SESSION_FILE = ".session_id.txt";
const LEGACY_PROJECT_SESSION_FILE = "session_id.txt";

export async function readProjectSessionId(projectRoot) {
  const sessionPath = path.join(projectRoot, PROJECT_SESSION_FILE);
  const legacySessionPath = path.join(projectRoot, LEGACY_PROJECT_SESSION_FILE);

  if (!(await fileExists(sessionPath)) && (await fileExists(legacySessionPath))) {
    await fs.rename(legacySessionPath, sessionPath);
  }

  if (!(await fileExists(sessionPath))) {
    return null;
  }

  const sessionId = await fs.readFile(sessionPath, "utf8");
  return sessionId.trim() || null;
}

export async function writeProjectSessionId(projectRoot, sessionId) {
  await fs.writeFile(
    path.join(projectRoot, PROJECT_SESSION_FILE),
    sessionId,
    "utf8"
  );
}
