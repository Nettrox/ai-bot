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

async function getFileInfo(projectRoot, fullPath) {
  const relativePath = path.relative(projectRoot, fullPath);
  const stat = await fs.stat(fullPath);

  if (stat.size > MAX_FILE_SIZE) {
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

export async function createProjectSnapshot(projectRoot) {
  const snapshotDir = path.join(projectRoot, ".context");

  await fs.mkdir(snapshotDir, {
    recursive: true
  });

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

      if (entry.isDirectory()) {
        await walk(fullPath);
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const fileInfo = await getFileInfo(projectRoot, fullPath);
      files.push(fileInfo);
    }
  }

  await walk(projectRoot);

  files.sort((a, b) => a.path.localeCompare(b.path));

  const snapshot = {
    project_name: path.basename(projectRoot),
    last_updated: new Date().toISOString(),
    file_count: files.length,
    files
  };

  const snapshotPath = path.join(
    snapshotDir,
    "project_snapshot.json"
  );

  await fs.writeFile(
    snapshotPath,
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
    const raw = await fs.readFile(snapshotPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}