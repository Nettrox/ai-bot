import fs from "fs/promises";
import path from "path";
import { spawn } from "child_process";
import {
  BLOCKED_COMMAND_PATTERNS,
  IGNORED_DIRS,
  PROTECTED_DIRS,
  PROTECTED_FILES
} from "./config.js";
import { createProjectSnapshot } from "./projectScanner.js";
import { writeProjectSessionId } from "./sessionStore.js";
import { fileExists, getTimestamp, normalizeProjectPath } from "./utils.js";

export function isProtectedPath(filePath) {
  const normalized = normalizeProjectPath(filePath);
  const parts = normalized.split("/");

  return PROTECTED_FILES.has(normalized) || parts.some((part) => PROTECTED_DIRS.has(part));
}

export async function copyRecursive(source, destination) {
  const stat = await fs.stat(source);

  if (stat.isDirectory()) {
    const folderName = path.basename(source);

    if (IGNORED_DIRS.has(folderName)) {
      return;
    }

    await fs.mkdir(destination, { recursive: true });

    for (const entry of await fs.readdir(source)) {
      await copyRecursive(path.join(source, entry), path.join(destination, entry));
    }

    return;
  }

  if (stat.isFile()) {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  }
}

export async function createBackup(projectRoot) {
  const backupRoot = path.join(projectRoot, ".backup");
  await fs.mkdir(backupRoot, { recursive: true });

  let backupPath = path.join(backupRoot, getTimestamp());
  let counter = 1;

  while (await fileExists(backupPath)) {
    backupPath = path.join(backupRoot, `${getTimestamp()}-${counter}`);
    counter++;
  }

  await fs.mkdir(backupPath, { recursive: true });

  for (const entry of await fs.readdir(projectRoot)) {
    if (IGNORED_DIRS.has(entry)) continue;
    await copyRecursive(path.join(projectRoot, entry), path.join(backupPath, entry));
  }

  return backupPath;
}

export async function applyProjectPlan({
  baseFolder,
  plan,
  sessionId,
  existingProject
}) {
  const projectRoot = existingProject
    ? baseFolder
    : path.join(baseFolder, plan.project_name);

  await fs.mkdir(projectRoot, { recursive: true });

  for (const folder of plan.folders || []) {
    if (isProtectedPath(folder)) {
      console.log("Korumali klasor atlandi:", folder);
      continue;
    }

    await fs.mkdir(path.join(projectRoot, folder), { recursive: true });
  }

  for (const relativePath of plan.delete_files || []) {
    if (isProtectedPath(relativePath)) {
      console.log("Korumali yol silinmedi:", relativePath);
      continue;
    }

    const targetPath = path.join(projectRoot, relativePath);

    if (await fileExists(targetPath)) {
      await fs.rm(targetPath, { recursive: true, force: true });
    }
  }

  for (const file of plan.files || []) {
    if (!file.path) continue;

    if (isProtectedPath(file.path)) {
      console.log("Korumali dosya yazilmadi:", file.path);
      continue;
    }

    const targetPath = path.join(projectRoot, file.path);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.content ?? "", "utf8");
  }

  for (const patch of plan.patches || []) {
    if (!patch.path) continue;

    if (isProtectedPath(patch.path)) {
      console.log("Korumali dosyaya patch uygulanmadi:", patch.path);
      continue;
    }

    const targetPath = path.join(projectRoot, patch.path);

    if (!(await fileExists(targetPath))) {
      throw new Error(`Patch hedef dosyasi bulunamadi: ${patch.path}`);
    }

    const currentContent = await fs.readFile(targetPath, "utf8");
    const matchCount = currentContent.split(patch.search).length - 1;

    if (matchCount === 0) {
      throw new Error(`Patch search metni bulunamadi: ${patch.path}`);
    }

    if (matchCount > 1) {
      throw new Error(`Patch search metni birden fazla bulundu: ${patch.path}`);
    }

    await fs.writeFile(
      targetPath,
      currentContent.replace(patch.search, patch.replace),
      "utf8"
    );
  }

  await writeProjectSessionId(projectRoot, sessionId);
  return projectRoot;
}

export async function updateSnapshot(projectRoot, logData = null) {
  await createProjectSnapshot(projectRoot);

  if (logData) {
    logData.snapshot_updated = true;
  }

  console.log("Project snapshot guncellendi.");
}

export function isSafeCommand(command) {
  const normalized = command.toLowerCase();
  return !BLOCKED_COMMAND_PATTERNS.some((blocked) => normalized.includes(blocked));
}

export function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    if (!isSafeCommand(command)) {
      reject({
        command,
        code: "blocked",
        stdout: "",
        stderr: "",
        message: `Guvenli olmayan komut engellendi: ${command}`
      });
      return;
    }

    console.log(`\nCalistiriliyor: ${command}`);

    const child = spawn(command, {
      cwd,
      shell: true
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      const text = data.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on("data", (data) => {
      const text = data.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on("error", (error) => {
      reject({
        command,
        message: error.message,
        stdout,
        stderr
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject({
          command,
          code,
          stdout,
          stderr,
          message: `Komut hata kodu ile bitti (${code}): ${command}`
        });
        return;
      }

      resolve({ command, code, stdout, stderr });
    });
  });
}
