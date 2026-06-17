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

async function getSessionIdFromFolder(folderPath) {
  const sessionFilePath = path.join(folderPath, "session_id.txt");

  if (!(await fileExists(sessionFilePath))) {
    return null;
  }

  const sessionId = await fs.readFile(sessionFilePath, "utf8");
  return sessionId.trim() || null;
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

  const existingSessionId = await getSessionIdFromFolder(selectedFolder);

  const userRequest = await getInput("İsteğini yaz: ");

  const systemPrompt = await readPrompt("./prompt/project_generator.txt");

  const finalPrompt = `
${systemPrompt}

KULLANICI ISTEGI:

${userRequest}
`;

  let sessionId;
  let answer;
  let isExistingProject = false;

  if (existingSessionId) {
    sessionId = existingSessionId;
    isExistingProject = true;

    console.log("Mevcut session bulundu:", sessionId);
    console.log("Var olan proje üzerinden devam ediliyor...");

    answer = await oldAskOdysseus(sessionId, finalPrompt);
  } else {
    sessionId = await createNewSession();

    console.log("Yeni session oluşturuldu:", sessionId);

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