import fs from "fs/promises";
import path from "path";
import { getTimestamp } from "./utils.js";

export function createRunLog() {
  return {
    timestamp: new Date().toISOString(),
    status: "started",
    mode: null,
    selected_folder: null,
    project_path: null,
    session_id: null,
    dry_run_session_id: null,
    user_request: null,
    model_response: null,
    project_data: null,
    backup_path: null,
    dry_run_plan_path: null,
    install_commands: [],
    run_commands: [],
    snapshot_updated: false,
    errors: []
  };
}

export async function saveRunLog(logData, basePath = process.cwd()) {
  const logRoot =
    logData.project_path || logData.selected_folder || basePath || process.cwd();

  const logsDir = path.join(logRoot, ".logs");
  await fs.mkdir(logsDir, { recursive: true });

  const logPath = path.join(logsDir, `${getTimestamp()}.json`);
  await fs.writeFile(logPath, JSON.stringify(logData, null, 2), "utf8");

  console.log("Log kaydedildi:", logPath);
}
