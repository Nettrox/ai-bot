#!/usr/bin/env node

import fs from "fs/promises";
import path from "path";
import { copyRecursive } from "./src/projectApplier.js";
import { fileExists, resolveFolder } from "./src/utils.js";

const PRESERVE_ITEMS = new Set([".backup", ".logs"]);

async function getLatestBackup(projectRoot) {
  const backupRoot = path.join(projectRoot, ".backup");

  if (!(await fileExists(backupRoot))) {
    throw new Error(".backup klasoru bulunamadi.");
  }

  const backupFolders = (await fs.readdir(backupRoot, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  if (backupFolders.length === 0) {
    throw new Error(".backup icinde backup bulunamadi.");
  }

  return path.join(backupRoot, backupFolders.at(-1));
}

async function clearProjectFolder(projectRoot) {
  for (const entry of await fs.readdir(projectRoot)) {
    if (PRESERVE_ITEMS.has(entry)) continue;

    await fs.rm(path.join(projectRoot, entry), {
      recursive: true,
      force: true
    });
  }
}

async function restoreBackup(projectRoot, backupPath) {
  for (const entry of await fs.readdir(backupPath)) {
    await copyRecursive(
      path.join(backupPath, entry),
      path.join(projectRoot, entry)
    );
  }
}

async function runRollback() {
  const args = process.argv.slice(2);
  const projectRoot = await resolveFolder(
    args,
    "Rollback yapilacak proje klasorunu sec"
  );
  const latestBackup = await getLatestBackup(projectRoot);

  console.log("Secilen proje:", projectRoot);
  console.log("Geri donulecek backup:", latestBackup);

  await clearProjectFolder(projectRoot);
  await restoreBackup(projectRoot, latestBackup);

  console.log("\nRollback tamamlandi.");
}

runRollback().catch((error) => {
  console.error("Rollback hatasi:", error.message || error);
  process.exitCode = 1;
});
