import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

import { createNewSession } from "./func/createNewSession.js";
import { getInput } from "./func/getInput.js";
import { saveCurrentSession } from "./func/saveCurrentSession.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { oldAskOdysseus } from "./func/oldAskOdysseus.js";

const execFileAsync = promisify(execFile);

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
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

const MAX_FILE_SIZE = 200_000;

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

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
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

function shouldIgnorePath(name) {
  return IGNORE_DIRS.has(name) || IGNORE_FILES.has(name);
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

      result.push({
        path: relativePath,
        content
      });
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

function extractJson(text) {
  const firstIndex = text.indexOf("{");
  const lastIndex = text.lastIndexOf("}");

  if (firstIndex === -1 || lastIndex === -1) {
    throw new Error("Model cevabında JSON bulunamadı.");
  }

  const jsonText = text.slice(firstIndex, lastIndex + 1);
  return JSON.parse(jsonText);
}

async function writeSessionId(projectRoot, sessionId) {
  const sessionFilePath = path.join(projectRoot, "session_id.txt");
  await fs.writeFile(sessionFilePath, sessionId, "utf8");
}

async function applyProjectChanges(baseFolder, projectData, sessionId, isExistingProject) {
  let projectRoot;

  if (isExistingProject) {
    projectRoot = baseFolder;
  } else {
    projectRoot = path.join(baseFolder, projectData.project_name);
    await fs.mkdir(projectRoot, { recursive: true });
  }

  for (const folder of projectData.folders || []) {
    const folderPath = path.join(projectRoot, folder);
    await fs.mkdir(folderPath, { recursive: true });
  }

  for (const filePath of projectData.delete_files || []) {
    const targetPath = path.join(projectRoot, filePath);

    if (await fileExists(targetPath)) {
      await fs.rm(targetPath, { force: true });
    }
  }

  for (const file of projectData.files || []) {
    const targetPath = path.join(projectRoot, file.path);
    const targetDir = path.dirname(targetPath);

    await fs.mkdir(targetDir, { recursive: true });
    await fs.writeFile(targetPath, file.content, "utf8");
  }

  await writeSessionId(projectRoot, sessionId);

  return projectRoot;
}

try {
  const selectedFolder = await selectFolder();
  const folderName = path.basename(selectedFolder);

  const existingSessionId = await getSessionIdFromFolder(selectedFolder);
  const folderIsEmpty = await isFolderEmpty(selectedFolder);

  const userRequest = await getInput("İsteğini yaz: ");
  const systemPrompt = await readPrompt("./prompt/project_generator.txt");

  let sessionId;
  let answer;
  let isExistingProject = false;

  if (existingSessionId) {
    sessionId = existingSessionId;
    isExistingProject = true;

    console.log("Mevcut session bulundu:", sessionId);
    console.log("Var olan proje üzerinden devam ediliyor...");

    const finalPrompt = `
${systemPrompt}

KULLANICI ISTEGI:

${userRequest}
`;

    answer = await oldAskOdysseus(sessionId, finalPrompt);
  } else if (!folderIsEmpty) {
    sessionId = await createNewSession();
    isExistingProject = true;

    console.log("Session bulunamadı ama klasör dolu.");
    console.log("Mevcut proje taranıyor...");
    console.log("Yeni session oluşturuldu:", sessionId);

    const files = await scanProjectFiles(selectedFolder);

    const existingProjectPrompt = buildExistingProjectPrompt(folderName, files);

    const finalPrompt = `
${systemPrompt}

${existingProjectPrompt}

KULLANICI ISTEGI:

${userRequest}
`;

    answer = await newAskOdysseus(sessionId, finalPrompt);

    await saveCurrentSession(sessionId);
  } else {
    sessionId = await createNewSession();
    isExistingProject = false;

    console.log("Boş klasör seçildi.");
    console.log("Yeni session oluşturuldu:", sessionId);

    const finalPrompt = `
${systemPrompt}

KULLANICI ISTEGI:

${userRequest}
`;

    answer = await newAskOdysseus(sessionId, finalPrompt);

    await saveCurrentSession(sessionId);
  }

  console.log("\n");
  console.log("=================================");
  console.log("MODEL OUTPUT");
  console.log("=================================");
  console.log(answer);

  const projectData = extractJson(answer);

  const projectPath = await applyProjectChanges(
    selectedFolder,
    projectData,
    sessionId,
    isExistingProject
  );

  console.log("\n");
  console.log("=================================");
  console.log(
    isExistingProject
      ? "PROJE GUNCELLENDI"
      : "PROJE OLUSTURULDU"
  );
  console.log("=================================");

  if (projectData.commands?.length) {
    console.log("\nKomutlar:");
    for (const command of projectData.commands) {
      console.log("-", command);
    }
  }
} catch (err) {
  console.error("HATA:", err.message);
}