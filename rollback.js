import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

const PRESERVE_ITEMS = new Set([
  ".backup",
  ".logs"
]);

async function selectFolder() {
  const script = `
    set selectedFolder to choose folder with prompt "Rollback yapılacak proje klasörünü seç"
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

async function copyRecursive(source, destination) {
  const stat = await fs.stat(source);

  if (stat.isDirectory()) {
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

  if (stat.isFile()) {
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.copyFile(source, destination);
  }
}

async function getLatestBackup(projectRoot) {
  const backupRoot = path.join(projectRoot, ".backup");

  if (!(await fileExists(backupRoot))) {
    throw new Error(".backup klasörü bulunamadı.");
  }

  const backups = await fs.readdir(backupRoot, {
    withFileTypes: true
  });

  const backupFolders = backups
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (backupFolders.length === 0) {
    throw new Error(".backup içinde backup bulunamadı.");
  }

  const latestBackupName = backupFolders[backupFolders.length - 1];

  return path.join(backupRoot, latestBackupName);
}

async function clearProjectFolder(projectRoot) {
  const entries = await fs.readdir(projectRoot);

  for (const entry of entries) {
    if (PRESERVE_ITEMS.has(entry)) {
      continue;
    }

    const targetPath = path.join(projectRoot, entry);

    await fs.rm(targetPath, {
      recursive: true,
      force: true
    });
  }
}

async function restoreBackup(projectRoot, backupPath) {
  const entries = await fs.readdir(backupPath);

  for (const entry of entries) {
    await copyRecursive(
      path.join(backupPath, entry),
      path.join(projectRoot, entry)
    );
  }
}

try {
  const projectRoot = await selectFolder();

  const latestBackup = await getLatestBackup(projectRoot);

  console.log("Seçilen proje:", projectRoot);
  console.log("Geri dönülecek backup:", latestBackup);

  await clearProjectFolder(projectRoot);
  await restoreBackup(projectRoot, latestBackup);

  console.log("\nRollback tamamlandı.");
} catch (err) {
  console.error("Rollback hatası:", err.message || err);
}