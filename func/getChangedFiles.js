import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const IGNORE_DIRS = new Set([
  ".git",
  ".backup",
  ".logs",
  ".context",
  ".dry-run",
  "node_modules",
  "dist",
  "build",
  ".next",
  ".vite",
  ".turbo",
  "coverage"
]);

const IGNORE_FILES = new Set([
  ".DS_Store",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml"
]);

const MAX_FILE_SIZE = 500_000;

function calculateHash(content) {
  return crypto
    .createHash("sha256")
    .update(content)
    .digest("hex");
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readSnapshot(projectRoot) {
  const snapshotPath = path.join(
    projectRoot,
    ".context",
    "project_snapshot.json"
  );

  if (!(await fileExists(snapshotPath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(snapshotPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function getCurrentFiles(projectRoot) {
  const files = [];

  async function walk(current) {
    const entries = await fs.readdir(current, {
      withFileTypes: true
    });

    for (const entry of entries) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }

      if (IGNORE_FILES.has(entry.name)) {
        continue;
      }

      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(projectRoot, fullPath);

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const stat = await fs.stat(fullPath);

      if (stat.size > MAX_FILE_SIZE) {
        files.push({
          path: relativePath,
          size: stat.size,
          hash: null,
          skipped: true,
          reason: "file_too_large"
        });

        continue;
      }

      try {
        const content = await fs.readFile(fullPath);

        files.push({
          path: relativePath,
          size: stat.size,
          hash: calculateHash(content),
          skipped: false
        });
      } catch {
        files.push({
          path: relativePath,
          size: stat.size,
          hash: null,
          skipped: true,
          reason: "unreadable_file"
        });
      }
    }
  }

  await walk(projectRoot);

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function getChangedFiles(projectRoot) {
  const snapshot = await readSnapshot(projectRoot);

  if (!snapshot || !Array.isArray(snapshot.files)) {
    return {
      has_snapshot: false,
      changed_files: [],
      added_files: [],
      modified_files: [],
      deleted_files: [],
      skipped_files: []
    };
  }

  const currentFiles = await getCurrentFiles(projectRoot);

  const oldMap = new Map();
  const currentMap = new Map();

  for (const file of snapshot.files) {
    oldMap.set(file.path, file);
  }

  for (const file of currentFiles) {
    currentMap.set(file.path, file);
  }

  const addedFiles = [];
  const modifiedFiles = [];
  const deletedFiles = [];
  const skippedFiles = [];

  for (const currentFile of currentFiles) {
    const oldFile = oldMap.get(currentFile.path);

    if (currentFile.skipped) {
      skippedFiles.push(currentFile.path);
      continue;
    }

    if (!oldFile) {
      addedFiles.push(currentFile.path);
      continue;
    }

    if (oldFile.hash !== currentFile.hash) {
      modifiedFiles.push(currentFile.path);
    }
  }

  for (const oldFile of snapshot.files) {
    if (!currentMap.has(oldFile.path)) {
      deletedFiles.push(oldFile.path);
    }
  }

  const changedFiles = [
    ...addedFiles,
    ...modifiedFiles
  ].sort();

  return {
    has_snapshot: true,
    changed_files: changedFiles,
    added_files: addedFiles.sort(),
    modified_files: modifiedFiles.sort(),
    deleted_files: deletedFiles.sort(),
    skipped_files: skippedFiles.sort()
  };
}