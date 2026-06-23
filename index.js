import fs from "fs/promises";
import path from "path";
import { execFile, spawn } from "child_process";
import { promisify } from "util";

import { createProjectSnapshot } from "./func/createProjectSnapshot.js";
import { createNewSession } from "./func/createNewSession.js";
import { getInput } from "./func/getInput.js";
import { saveCurrentSession } from "./func/saveCurrentSession.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { oldAskOdysseus } from "./func/oldAskOdysseus.js";
import { getChangedFiles } from "./func/getChangedFiles.js";
import { readChangedFiles } from "./func/readChangedFiles.js";

const execFileAsync = promisify(execFile);

const DRY_RUN =
  process.argv.includes("--dry-run") ||
  process.env.DRY_RUN === "true";

const APPLY_DRY_RUN =
  process.argv.includes("--apply-dry-run");

const BLOCKED_COMMANDS = [
  "sudo",
  "rm -rf",
  "del ",
  "format",
  "chmod -R 777",
  "mkfs",
  "shutdown",
  "reboot"
];

const IGNORE_DIRS = new Set([
  ".context",
  "node_modules",
  ".git",
  ".backup",
  ".logs",
  ".dry-run",
  "dist",
  "build",
  ".next",
  ".vite",
  ".turbo",
  "coverage",
  ".DS_Store"
]);

const IGNORE_FILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".DS_Store",
  "session_id.txt"
]);

const BACKUP_IGNORE_DIRS = new Set([
  ".context",
  "node_modules",
  ".git",
  ".backup",
  ".logs",
  ".dry-run",
  "dist",
  "build",
  ".next",
  ".vite",
  ".turbo",
  "coverage"
]);

const PROTECTED_FILES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  "session_id.txt",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml"
]);

const PROTECTED_DIRS = new Set([
  ".context",
  ".git",
  "node_modules",
  ".backup",
  ".logs",
  ".dry-run",
  "dist",
  "build"
]);

const MAX_FILE_SIZE = 200_000;
const MAX_CHANGED_FILES_TO_SEND = 20;

function getTimestamp() {
  return new Date()
    .toISOString()
    .replace(/:/g, "-")
    .replace(/\..+/, "");
}

function createEmptyLog() {
  return {
    timestamp: new Date().toISOString(),
    snapshot_updated: false,
    status: "started",
    dry_run: DRY_RUN,
    apply_dry_run: APPLY_DRY_RUN,
    mode: null,
    session_id: null,
    dry_run_session_id: null,
    selected_folder: null,
    project_path: null,
    user_request: null,
    model_response: null,
    project_data: null,
    backup_path: null,
    dry_run_plan_path: null,
    install_commands: [],
    run_commands: [],
    errors: []
  };
}

async function saveLog(logData, projectPath = null) {
  const basePath =
    projectPath ||
    logData.project_path ||
    logData.selected_folder ||
    process.cwd();

  const logsDir = path.join(basePath, ".logs");
  await fs.mkdir(logsDir, { recursive: true });

  const logPath = path.join(logsDir, `${getTimestamp()}.json`);

  await fs.writeFile(
    logPath,
    JSON.stringify(logData, null, 2),
    "utf8"
  );

  console.log("Log kaydedildi:", logPath);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readPrompt(filePath) {
  return await fs.readFile(filePath, "utf8");
}

async function selectFolder() {
  const script = `
    set selectedFolder to choose folder with prompt "Proje klasörünü seç"
    POSIX path of selectedFolder
  `;

  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  const folderPath = stdout.trim();

  if (!folderPath) {
    throw new Error("Klasör seçilmedi.");
  }

  return folderPath;
}

async function isFolderEmpty(folderPath) {
  const items = await fs.readdir(folderPath);
  const visibleItems = items.filter((item) => item !== ".DS_Store");
  return visibleItems.length === 0;
}

async function getSessionIdFromFolder(folderPath) {
  const sessionFilePath = path.join(folderPath, "session_id.txt");

  if (!(await fileExists(sessionFilePath))) {
    return null;
  }

  const sessionId = await fs.readFile(sessionFilePath, "utf8");
  return sessionId.trim() || null;
}

function normalizeProjectPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\/+/, "");
}

function isProtectedPath(filePath) {
  const normalized = normalizeProjectPath(filePath);
  const parts = normalized.split("/");

  if (PROTECTED_FILES.has(normalized)) {
    return true;
  }

  return parts.some((part) => PROTECTED_DIRS.has(part));
}

function shouldIgnorePath(name) {
  return IGNORE_DIRS.has(name) || IGNORE_FILES.has(name);
}

function shouldIgnoreBackupPath(name) {
  return BACKUP_IGNORE_DIRS.has(name);
}

async function copyRecursive(source, destination) {
  const stat = await fs.stat(source);

  if (stat.isDirectory()) {
    const folderName = path.basename(source);

    if (shouldIgnoreBackupPath(folderName)) {
      return;
    }

    await fs.mkdir(destination, { recursive: true });

    const entries = await fs.readdir(source);

    for (const entry of entries) {
      await copyRecursive(
        path.join(source, entry),
        path.join(destination, entry)
      );
    }

    return;
  }

  if (!stat.isFile()) return;

  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.copyFile(source, destination);
}

async function createBackup(projectRoot) {
  const backupRoot = path.join(projectRoot, ".backup");
  await fs.mkdir(backupRoot, { recursive: true });

  const timestamp = getTimestamp();
  let backupFolder = path.join(backupRoot, timestamp);

  let counter = 1;
  while (await fileExists(backupFolder)) {
    backupFolder = path.join(backupRoot, `${timestamp}-${counter}`);
    counter++;
  }

  await fs.mkdir(backupFolder, { recursive: true });

  const entries = await fs.readdir(projectRoot);

  for (const entry of entries) {
    if (shouldIgnoreBackupPath(entry)) continue;

    await copyRecursive(
      path.join(projectRoot, entry),
      path.join(backupFolder, entry)
    );
  }

  return backupFolder;
}

async function scanProjectFiles(rootFolder, currentFolder = rootFolder) {
  const result = [];
  const entries = await fs.readdir(currentFolder, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldIgnorePath(entry.name)) continue;

    const fullPath = path.join(currentFolder, entry.name);
    const relativePath = path.relative(rootFolder, fullPath);

    if (entry.isDirectory()) {
      const nestedFiles = await scanProjectFiles(rootFolder, fullPath);
      result.push(...nestedFiles);
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = await fs.stat(fullPath);

    if (stat.size > MAX_FILE_SIZE) {
      result.push({
        path: relativePath,
        content: `[SKIPPED: file too large, ${stat.size} bytes]`
      });
      continue;
    }

    try {
      const content = await fs.readFile(fullPath, "utf8");
      result.push({ path: relativePath, content });
    } catch {
      result.push({
        path: relativePath,
        content: "[SKIPPED: binary or unreadable file]"
      });
    }
  }

  return result;
}

function buildExistingProjectPrompt(projectName, files) {
  return `
MEVCUT PROJE BILGILERI:

project_name: ${projectName}

Aşağıda seçilen klasördeki mevcut proje dosyaları var.
Bu dosyaları mevcut proje olarak kabul et.
Yeni proje oluşturma.
Bundan sonraki isteği bu mevcut proje üzerinden uygula.

${JSON.stringify(
  {
    project_name: projectName,
    files
  },
  null,
  2
)}
`;
}

function buildChangedFilesPrompt(changedData, changedFilesContent = []) {
  return `
MEVCUT PROJE DEGISIKLIK ANALIZI:

Snapshot karşılaştırmasına göre projede değişen dosyalar aşağıdadır.
Bu bilgiler mevcut proje bağlamını güncellemek için verilmiştir.

Added Files:
${JSON.stringify(changedData.added_files || [], null, 2)}

Modified Files:
${JSON.stringify(changedData.modified_files || [], null, 2)}

Deleted Files:
${JSON.stringify(changedData.deleted_files || [], null, 2)}

Skipped Files:
${JSON.stringify(changedData.skipped_files || [], null, 2)}

DEGISEN DOSYA ICERIKLERI:

${JSON.stringify(changedFilesContent || [], null, 2)}
`;
}

async function buildProjectContextPrompt(projectRoot, projectName) {
  const changedData = await getChangedFiles(projectRoot);

  if (
    changedData.has_snapshot &&
    changedData.changed_files.length > 0 &&
    changedData.changed_files.length <= MAX_CHANGED_FILES_TO_SEND
  ) {
    const changedFilesContent = await readChangedFiles(
      projectRoot,
      changedData.changed_files
    );

    console.log(
      "Snapshot kullanıldı. Değişen dosya sayısı:",
      changedData.changed_files.length
    );

    return buildChangedFilesPrompt(changedData, changedFilesContent);
  }

  if (
    changedData.has_snapshot &&
    changedData.changed_files.length === 0
  ) {
    console.log("Snapshot kullanıldı. Disk üzerinde değişen dosya yok.");

    return `
MEVCUT PROJE SNAPSHOT BILGISI:

Snapshot mevcut ve son snapshot'a göre disk üzerinde değişen dosya bulunamadı.
Önceki session bağlamını ve kullanıcının isteğini dikkate alarak devam et.
`;
  }

  const files = await scanProjectFiles(projectRoot);

  console.log("Tam proje taraması yapıldı.");

  return buildExistingProjectPrompt(projectName, files);
}

function buildDryRunPrompt(systemPrompt, userRequest, existingProjectPrompt = "") {
  return `
${systemPrompt}

DRY-RUN MODU AKTIF.

Bu istek sadece ön izleme içindir.
Bu değişiklikler henüz gerçek proje dosyalarına uygulanmayacak.
Bu dry-run sonucunu, açıkça apply edildiği bildirilmediği sürece mevcut proje durumu olarak kabul etme.
Önceki dry-run isteklerini, açıkça uygulandığı belirtilmedikçe gerçek proje durumuna dahil etme.

${existingProjectPrompt}

KULLANICI ISTEGI:

${userRequest}
`;
}

function buildNormalPrompt(systemPrompt, userRequest, existingProjectPrompt = "") {
  return `
${systemPrompt}

${existingProjectPrompt}

KULLANICI ISTEGI:

${userRequest}
`;
}

function buildDryRunAppliedNotification(projectData) {
  return `
DRY-RUN APPLY BILDIRIMI:

Aşağıdaki dry-run planı gerçek proje dosyalarına başarıyla uygulandı.

Bundan sonraki isteklerde bu değişiklikleri mevcut proje durumuna dahil et.
Uygulanmamış eski dry-run planlarını gerçek proje durumuna dahil etme.

UYGULANAN PLAN:

${JSON.stringify(projectData, null, 2)}

Bu sadece session güncelleme bildirimidir.
Yeni dosya üretme.
Eğer cevap vermen gerekiyorsa yalnızca geçerli JSON formatında boş update cevabı döndür.
`;
}

function extractJson(text) {
  const firstIndex = text.indexOf("{");
  const lastIndex = text.lastIndexOf("}");

  if (firstIndex === -1 || lastIndex === -1) {
    throw new Error("Model cevabında JSON bulunamadı.");
  }

  const jsonText = text.slice(firstIndex, lastIndex + 1);
  return JSON.parse(jsonText);
}

function validateProjectData(projectData) {
  const errors = [];

  if (!projectData || typeof projectData !== "object") {
    errors.push("JSON root object olmalı.");
    return errors;
  }

  if (!["create", "update"].includes(projectData.action)) {
    errors.push('action "create" veya "update" olmalı.');
  }

  if (
    typeof projectData.project_name !== "string" ||
    !projectData.project_name.trim()
  ) {
    errors.push("project_name boş olmayan string olmalı.");
  }

  if (typeof projectData.description !== "string") {
    errors.push("description string olmalı.");
  }

  if (!Array.isArray(projectData.folders)) {
    errors.push("folders array olmalı.");
  }

  if (!Array.isArray(projectData.files)) {
    errors.push("files array olmalı.");
  }

  if (!Array.isArray(projectData.delete_files)) {
    errors.push("delete_files array olmalı.");
  }

  if (!Array.isArray(projectData.install_commands)) {
    errors.push("install_commands array olmalı.");
  }

  if (!Array.isArray(projectData.run_commands)) {
    errors.push("run_commands array olmalı.");
  }

  if (Array.isArray(projectData.files)) {
    for (const [index, file] of projectData.files.entries()) {
      if (!file || typeof file !== "object") {
        errors.push(`files[${index}] object olmalı.`);
        continue;
      }

      if (typeof file.path !== "string" || !file.path.trim()) {
        errors.push(`files[${index}].path boş olmayan string olmalı.`);
      }

      if (typeof file.content !== "string") {
        errors.push(`files[${index}].content string olmalı.`);
      }
    }
  }

  return errors;
}

async function parseProjectDataWithRetry({
  answer,
  sessionId,
  maxAttempts = 2
}) {
  let currentAnswer = answer;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const projectData = extractJson(currentAnswer);
      const validationErrors = validateProjectData(projectData);

      if (validationErrors.length === 0) {
        return projectData;
      }

      throw new Error(validationErrors.join("\n"));
    } catch (err) {
      if (attempt >= maxAttempts) {
        throw new Error(`Model geçerli JSON döndüremedi:\n${err.message}`);
      }

      const retryPrompt = `
Son cevabın geçerli proje JSON formatına uymuyor.

Hatalar:
${err.message}

Önceki cevabın:
${currentAnswer}

Lütfen aynı cevabı sadece geçerli JSON olarak tekrar döndür.
Markdown, açıklama, kod bloğu veya ekstra metin yazma.
Sadece JSON döndür.
`;

      console.log("\nJSON hatalı. Modelden tekrar valid JSON isteniyor...");

      currentAnswer = await oldAskOdysseus(sessionId, retryPrompt);
    }
  }
}

async function writeSessionId(projectRoot, sessionId) {
  const sessionFilePath = path.join(projectRoot, "session_id.txt");
  await fs.writeFile(sessionFilePath, sessionId, "utf8");
}

async function updateProjectSnapshot(projectPath, logData = null) {
  await createProjectSnapshot(projectPath);

  if (logData) {
    logData.snapshot_updated = true;
  }

  console.log("Project snapshot güncellendi.");
}

async function applyProjectChanges(
  baseFolder,
  projectData,
  sessionId,
  isExistingProject
) {
  let projectRoot;

  if (isExistingProject) {
    projectRoot = baseFolder;
  } else {
    projectRoot = path.join(baseFolder, projectData.project_name);
    await fs.mkdir(projectRoot, { recursive: true });
  }

  for (const folder of projectData.folders || []) {
    if (isProtectedPath(folder)) {
      console.log("Korumalı klasör oluşturulmadı:", folder);
      continue;
    }

    await fs.mkdir(path.join(projectRoot, folder), { recursive: true });
  }

  for (const filePath of projectData.delete_files || []) {
    if (isProtectedPath(filePath)) {
      console.log("Korumalı dosya/klasör silinmedi:", filePath);
      continue;
    }

    const targetPath = path.join(projectRoot, filePath);

    if (await fileExists(targetPath)) {
      await fs.rm(targetPath, { force: true, recursive: true });
    }
  }

  for (const file of projectData.files || []) {
    if (!file.path) continue;

    if (isProtectedPath(file.path)) {
      console.log("Korumalı dosya yazılmadı:", file.path);
      continue;
    }

    const targetPath = path.join(projectRoot, file.path);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, file.content ?? "", "utf8");
  }

  await writeSessionId(projectRoot, sessionId);

  return projectRoot;
}

function isSafeCommand(command) {
  const normalized = command.toLowerCase();

  return !BLOCKED_COMMANDS.some((blocked) =>
    normalized.includes(blocked.toLowerCase())
  );
}

function runCommand(command, cwd) {
  return new Promise((resolve, reject) => {
    if (!isSafeCommand(command)) {
      return reject({
        command,
        code: "blocked",
        stdout: "",
        stderr: "",
        message: `Güvensiz komut engellendi: ${command}`
      });
    }

    console.log(`\nÇalıştırılıyor: ${command}`);

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

    child.on("error", (err) => {
      reject({
        command,
        message: err.message,
        stdout,
        stderr
      });
    });

    child.on("close", (code) => {
      if (code !== 0) {
        return reject({
          command,
          code,
          stdout,
          stderr,
          message: `Komut hata kodu ile bitti (${code}): ${command}`
        });
      }

      resolve({
        command,
        code,
        stdout,
        stderr
      });
    });
  });
}

function buildErrorFixPrompt(commandError) {
  return `
OTOMATIK HATA DUZELTME ISTEGI:

Aşağıdaki komut çalıştırılırken hata oluştu.

COMMAND:
${commandError.command}

EXIT_CODE:
${commandError.code ?? "unknown"}

STDOUT:
${commandError.stdout || ""}

STDERR:
${commandError.stderr || ""}

MESSAGE:
${commandError.message || ""}

Bu hatayı mevcut proje üzerinde düzelt.
Sadece geçerli JSON döndür.
`;
}

async function runInstallCommandsWithAutoFix({
  commands,
  projectPath,
  sessionId,
  maxFixAttempts = 2,
  logData
}) {
  for (const command of commands || []) {
    let attempt = 0;

    while (attempt <= maxFixAttempts) {
      try {
        await runCommand(command, projectPath);
        break;
      } catch (commandError) {
        attempt++;

        console.log("\n=================================");
        console.log("KOMUT HATA VERDI");
        console.log("=================================");
        console.log(commandError.message);

        if (logData) {
          logData.errors.push({
            type: "command_error",
            command: commandError.command,
            code: commandError.code,
            message: commandError.message,
            stdout: commandError.stdout,
            stderr: commandError.stderr,
            timestamp: new Date().toISOString()
          });
        }

        if (attempt > maxFixAttempts) {
          throw new Error(
            `Komut ${maxFixAttempts} düzeltme denemesinden sonra başarısız oldu: ${command}`
          );
        }

        console.log("\nHata modele gönderiliyor ve düzeltme isteniyor...");

        const fixPrompt = buildErrorFixPrompt(commandError);
        const fixAnswer = await oldAskOdysseus(sessionId, fixPrompt);

        console.log("\n");
        console.log("=================================");
        console.log("FIX OUTPUT");
        console.log("=================================");
        console.log(fixAnswer);

        const fixData = await parseProjectDataWithRetry({
          answer: fixAnswer,
          sessionId,
          maxAttempts: 2
        });

        if (logData) {
          logData.errors.push({
            type: "auto_fix_response",
            model_response: fixAnswer,
            parsed_fix_data: fixData,
            timestamp: new Date().toISOString()
          });
        }

        const backupPath = await createBackup(projectPath);
        console.log("Fix öncesi backup oluşturuldu:", backupPath);

        await applyProjectChanges(projectPath, fixData, sessionId, true);
        await updateProjectSnapshot(projectPath, logData);

        if (fixData.install_commands?.length) {
          for (const fixCommand of fixData.install_commands) {
            await runCommand(fixCommand, projectPath);
          }
        }

        console.log("\nOrijinal komut tekrar deneniyor...");
      }
    }
  }
}

function printDryRun(projectData, isExistingProject) {
  console.log("\n");
  console.log("=================================");
  console.log("DRY RUN");
  console.log("=================================");

  console.log(
    "\nMod:",
    isExistingProject
      ? "Mevcut Proje Güncellemesi"
      : "Yeni Proje"
  );

  if (projectData.folders?.length) {
    console.log("\nOluşturulacak Klasörler:");
    for (const folder of projectData.folders) console.log("-", folder);
  }

  if (projectData.files?.length) {
    console.log("\nYazılacak Dosyalar:");
    for (const file of projectData.files) console.log("-", file.path);
  }

  if (projectData.delete_files?.length) {
    console.log("\nSilinecek Dosyalar:");
    for (const file of projectData.delete_files) console.log("-", file);
  }

  if (projectData.install_commands?.length) {
    console.log("\nÇalıştırılacak Kurulum Komutları:");
    for (const command of projectData.install_commands) console.log("-", command);
  }

  if (projectData.run_commands?.length) {
    console.log("\nÇalıştırma Komutları:");
    for (const command of projectData.run_commands) console.log("-", command);
  }

  console.log("\n=================================");
  console.log("DOSYA DEĞİŞİKLİĞİ YAPILMADI");
  console.log("=================================");
}

async function saveDryRunPlan(projectRoot, projectData, metadata = {}) {
  const dryRunDir = path.join(projectRoot, ".dry-run");
  await fs.mkdir(dryRunDir, { recursive: true });

  const dryRunPath = path.join(dryRunDir, "last-plan.json");

  await fs.writeFile(
    dryRunPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        metadata,
        project_data: projectData
      },
      null,
      2
    ),
    "utf8"
  );

  return dryRunPath;
}

async function readDryRunPlan(projectRoot) {
  const dryRunPath = path.join(projectRoot, ".dry-run", "last-plan.json");

  if (!(await fileExists(dryRunPath))) {
    throw new Error(".dry-run/last-plan.json bulunamadı.");
  }

  const raw = await fs.readFile(dryRunPath, "utf8");
  return JSON.parse(raw);
}

async function handleDryRun({
  selectedFolder,
  folderName,
  systemPrompt,
  userRequest,
  realSessionId,
  isExistingProject,
  logData
}) {
  const dryRunSessionId = await createNewSession();

  logData.dry_run_session_id = dryRunSessionId;

  console.log("Dry-run için geçici session oluşturuldu:", dryRunSessionId);

  let existingProjectPrompt = "";

  if (isExistingProject) {
    existingProjectPrompt = await buildProjectContextPrompt(
      selectedFolder,
      folderName
    );
  }

  const dryRunPrompt = buildDryRunPrompt(
    systemPrompt,
    userRequest,
    existingProjectPrompt
  );

  const dryRunAnswer = await newAskOdysseus(
    dryRunSessionId,
    dryRunPrompt
  );

  const dryRunData = await parseProjectDataWithRetry({
    answer: dryRunAnswer,
    sessionId: dryRunSessionId,
    maxAttempts: 2
  });

  const dryRunPath = await saveDryRunPlan(
    selectedFolder,
    dryRunData,
    {
      user_request: userRequest,
      dry_run_session_id: dryRunSessionId,
      real_session_id: realSessionId,
      is_existing_project: isExistingProject,
      mode: logData.mode,
      selected_folder: selectedFolder,
      created_at: new Date().toISOString()
    }
  );

  logData.status = "dry_run";
  logData.model_response = dryRunAnswer;
  logData.project_data = dryRunData;
  logData.dry_run_plan_path = dryRunPath;

  printDryRun(dryRunData, isExistingProject);

  console.log("\nDry-run plan kaydedildi:", dryRunPath);
  console.log("Uygulamak için:");
  console.log("node index.js --apply-dry-run");

  await saveLog(logData, selectedFolder);
}

async function handleApplyDryRun(logData) {
  const selectedFolder = await selectFolder();

  logData.selected_folder = selectedFolder;
  logData.mode = "apply_dry_run";

  const plan = await readDryRunPlan(selectedFolder);
  const projectData = plan.project_data;
  const metadata = plan.metadata || {};

  let sessionId =
    metadata.real_session_id ||
    await getSessionIdFromFolder(selectedFolder);

  let isExistingProject =
    metadata.is_existing_project !== undefined
      ? metadata.is_existing_project
      : true;

  if (!sessionId) {
    sessionId = await createNewSession();
    await saveCurrentSession(sessionId);
    isExistingProject = false;
  }

  logData.session_id = sessionId;
  logData.project_data = projectData;
  logData.install_commands = projectData.install_commands || [];
  logData.run_commands = projectData.run_commands || [];
  logData.dry_run_plan_path = path.join(
    selectedFolder,
    ".dry-run",
    "last-plan.json"
  );

  let backupTarget = null;

  if (isExistingProject) {
    backupTarget = selectedFolder;
  } else {
    const newProjectPath = path.join(selectedFolder, projectData.project_name);

    if (await fileExists(newProjectPath)) {
      backupTarget = newProjectPath;
    }
  }

  if (backupTarget) {
    console.log("\n=================================");
    console.log("APPLY ONCESI BACKUP ALINIYOR");
    console.log("=================================");

    const backupPath = await createBackup(backupTarget);
    logData.backup_path = backupPath;

    console.log("Backup oluşturuldu:", backupPath);
  }

  const projectPath = await applyProjectChanges(
    selectedFolder,
    projectData,
    sessionId,
    isExistingProject
  );

  await updateProjectSnapshot(
    projectPath,
    logData
  );

  logData.project_path = projectPath;

  if (projectData.install_commands?.length) {
    await runInstallCommandsWithAutoFix({
      commands: projectData.install_commands,
      projectPath,
      sessionId,
      maxFixAttempts: 2,
      logData
    });
  }

  if (projectData.run_commands?.length) {
    console.log("\nCalistirma komutlari:");
    for (const command of projectData.run_commands) {
      console.log("-", command);
    }
  }

  const notifyPrompt = buildDryRunAppliedNotification(projectData);

  try {
    const notifyAnswer = await oldAskOdysseus(sessionId, notifyPrompt);
    logData.model_response = notifyAnswer;
  } catch (err) {
    logData.errors.push({
      type: "dry_run_apply_notification_error",
      message: err.message || String(err),
      timestamp: new Date().toISOString()
    });
  }

  logData.status = "success";

  await saveLog(logData, projectPath);

  console.log("\nDry-run plan gerçek projeye uygulandı.");
}

const logData = createEmptyLog();

try {
  if (APPLY_DRY_RUN) {
    await handleApplyDryRun(logData);
    process.exit(0);
  }

  const selectedFolder = await selectFolder();
  const folderName = path.basename(selectedFolder);

  logData.selected_folder = selectedFolder;

  const existingSessionId = await getSessionIdFromFolder(selectedFolder);
  const folderIsEmpty = await isFolderEmpty(selectedFolder);

  const userRequest = await getInput("İsteğini yaz: ");
  const systemPrompt = await readPrompt("./prompt/project_generator.txt");

  logData.user_request = userRequest;

  let sessionId;
  let answer;
  let isExistingProject = false;
  let shouldBackupBeforeApply = false;

  if (existingSessionId) {
    sessionId = existingSessionId;
    isExistingProject = true;
    shouldBackupBeforeApply = true;

    logData.mode = "existing_project";
    logData.session_id = sessionId;

    console.log("Mevcut session bulundu:", sessionId);
    console.log("Var olan proje üzerinden devam ediliyor...");
  } else if (!folderIsEmpty) {
    sessionId = await createNewSession();
    isExistingProject = true;
    shouldBackupBeforeApply = true;

    logData.mode = "adopt_existing_project";
    logData.session_id = sessionId;

    console.log("Session bulunamadı ama klasör dolu.");
    console.log("Mevcut proje taranıyor...");
    console.log("Yeni session oluşturuldu:", sessionId);

    await saveCurrentSession(sessionId);
  } else {
    sessionId = await createNewSession();
    isExistingProject = false;
    shouldBackupBeforeApply = false;

    logData.mode = "new_project";
    logData.session_id = sessionId;

    console.log("Boş klasör seçildi.");
    console.log("Yeni session oluşturuldu:", sessionId);

    await saveCurrentSession(sessionId);
  }

  if (DRY_RUN) {
    await handleDryRun({
      selectedFolder,
      folderName,
      systemPrompt,
      userRequest,
      realSessionId: sessionId,
      isExistingProject,
      logData
    });

    process.exit(0);
  }

  let existingProjectPrompt = "";

  if (isExistingProject) {
    existingProjectPrompt = await buildProjectContextPrompt(
      selectedFolder,
      folderName
    );
  }

  const finalPrompt = buildNormalPrompt(
    systemPrompt,
    userRequest,
    existingProjectPrompt
  );

  if (existingSessionId) {
    answer = await oldAskOdysseus(sessionId, finalPrompt);
  } else {
    answer = await newAskOdysseus(sessionId, finalPrompt);
  }

  logData.model_response = answer;

  console.log("\n");
  console.log("=================================");
  console.log("MODEL OUTPUT");
  console.log("=================================");
  console.log(answer);

  const projectData = await parseProjectDataWithRetry({
    answer,
    sessionId,
    maxAttempts: 2
  });

  logData.project_data = projectData;
  logData.install_commands = projectData.install_commands || [];
  logData.run_commands = projectData.run_commands || [];

  if (shouldBackupBeforeApply) {
    console.log("\n=================================");
    console.log("BACKUP OLUSTURULUYOR");
    console.log("=================================");

    const backupPath = await createBackup(selectedFolder);
    logData.backup_path = backupPath;

    console.log("Backup oluşturuldu:", backupPath);
  }

  const projectPath = await applyProjectChanges(
    selectedFolder,
    projectData,
    sessionId,
    isExistingProject
  );

  await updateProjectSnapshot(
    projectPath,
    logData
  );

  logData.project_path = projectPath;

  console.log("\n");
  console.log("=================================");
  console.log(isExistingProject ? "PROJE GUNCELLENDI" : "PROJE OLUSTURULDU");
  console.log("=================================");
  console.log("Proje yolu:", projectPath);

  if (projectData.install_commands?.length) {
    console.log("\n=================================");
    console.log("KURULUM KOMUTLARI CALISTIRILIYOR");
    console.log("=================================");

    await runInstallCommandsWithAutoFix({
      commands: projectData.install_commands,
      projectPath,
      sessionId,
      maxFixAttempts: 2,
      logData
    });
  }

  if (projectData.run_commands?.length) {
    console.log("\nCalistirma komutlari:");
    for (const command of projectData.run_commands) {
      console.log("-", command);
    }
  }

  logData.status = "success";
  await saveLog(logData, projectPath);
} catch (err) {
  logData.status = "error";

  logData.errors.push({
    type: "fatal_error",
    message: err.message || String(err),
    timestamp: new Date().toISOString()
  });

  await saveLog(logData);

  console.error("HATA:", err.message || err);
}