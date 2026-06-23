import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import {
  IGNORED_DIRS,
  IGNORED_FILES,
  MAX_FILE_SIZE_TO_HASH,
  MAX_FILE_SIZE_TO_SEND
} from "./config.js";
import { fileExists } from "./utils.js";

function calculateHash(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function shouldIgnore(entryName) {
  return IGNORED_DIRS.has(entryName) || IGNORED_FILES.has(entryName);
}

export async function isFolderEmpty(folderPath) {
  const entries = await fs.readdir(folderPath);
  return entries.filter((entry) => entry !== ".DS_Store").length === 0;
}

export async function scanProjectFiles(projectRoot, current = projectRoot) {
  const result = [];
  const entries = await fs.readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;

    const fullPath = path.join(current, entry.name);
    const relativePath = path.relative(projectRoot, fullPath);

    if (entry.isDirectory()) {
      result.push(...(await scanProjectFiles(projectRoot, fullPath)));
      continue;
    }

    if (!entry.isFile()) continue;

    const stat = await fs.stat(fullPath);

    if (stat.size > MAX_FILE_SIZE_TO_SEND) {
      result.push({
        path: relativePath,
        content: `[SKIPPED: file too large, ${stat.size} bytes]`
      });
      continue;
    }

    try {
      result.push({
        path: relativePath,
        content: await fs.readFile(fullPath, "utf8")
      });
    } catch {
      result.push({
        path: relativePath,
        content: "[SKIPPED: binary or unreadable file]"
      });
    }
  }

  return result.sort((a, b) => a.path.localeCompare(b.path));
}

async function getFileInfo(projectRoot, fullPath) {
  const relativePath = path.relative(projectRoot, fullPath);
  const stat = await fs.stat(fullPath);

  if (stat.size > MAX_FILE_SIZE_TO_HASH) {
    return {
      path: relativePath,
      size: stat.size,
      hash: null,
      skipped: true,
      reason: "file_too_large"
    };
  }

  try {
    const content = await fs.readFile(fullPath);

    return {
      path: relativePath,
      size: stat.size,
      hash: calculateHash(content),
      skipped: false
    };
  } catch {
    return {
      path: relativePath,
      size: stat.size,
      hash: null,
      skipped: true,
      reason: "unreadable_file"
    };
  }
}

async function listHashableFiles(projectRoot, current = projectRoot) {
  const files = [];
  const entries = await fs.readdir(current, { withFileTypes: true });

  for (const entry of entries) {
    if (shouldIgnore(entry.name)) continue;

    const fullPath = path.join(current, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listHashableFiles(projectRoot, fullPath)));
      continue;
    }

    if (entry.isFile()) {
      files.push(await getFileInfo(projectRoot, fullPath));
    }
  }

  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export async function createProjectSnapshot(projectRoot) {
  const files = await listHashableFiles(projectRoot);
  const snapshot = {
    project_name: path.basename(projectRoot),
    last_updated: new Date().toISOString(),
    file_count: files.length,
    files
  };

  const snapshotDir = path.join(projectRoot, ".context");
  await fs.mkdir(snapshotDir, { recursive: true });
  await fs.writeFile(
    path.join(snapshotDir, "project_snapshot.json"),
    JSON.stringify(snapshot, null, 2),
    "utf8"
  );

  return snapshot;
}

export async function readProjectSnapshot(projectRoot) {
  const snapshotPath = path.join(
    projectRoot,
    ".context",
    "project_snapshot.json"
  );

  if (!(await fileExists(snapshotPath))) {
    return null;
  }

  try {
    return JSON.parse(await fs.readFile(snapshotPath, "utf8"));
  } catch {
    return null;
  }
}

export async function getChangedFiles(projectRoot) {
  const snapshot = await readProjectSnapshot(projectRoot);

  if (!snapshot?.files) {
    return {
      has_snapshot: false,
      changed_files: [],
      added_files: [],
      modified_files: [],
      deleted_files: [],
      skipped_files: []
    };
  }

  const currentFiles = await listHashableFiles(projectRoot);
  const oldMap = new Map(snapshot.files.map((file) => [file.path, file]));
  const currentMap = new Map(currentFiles.map((file) => [file.path, file]));
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

  return {
    has_snapshot: true,
    changed_files: [...addedFiles, ...modifiedFiles].sort(),
    added_files: addedFiles.sort(),
    modified_files: modifiedFiles.sort(),
    deleted_files: deletedFiles.sort(),
    skipped_files: skippedFiles.sort()
  };
}

export async function readChangedFiles(projectRoot, changedFiles) {
  const result = [];

  for (const relativePath of changedFiles) {
    const fullPath = path.join(projectRoot, relativePath);

    try {
      const stat = await fs.stat(fullPath);

      if (stat.size > MAX_FILE_SIZE_TO_SEND) {
        result.push({
          path: relativePath,
          content: "[SKIPPED: file too large]"
        });
        continue;
      }

      result.push({
        path: relativePath,
        content: await fs.readFile(fullPath, "utf8")
      });
    } catch {
      result.push({
        path: relativePath,
        content: "[SKIPPED: file missing]"
      });
    }
  }

  return result;
}
