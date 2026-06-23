import fs from "fs/promises";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { getInput } from "./input.js";

const execFileAsync = promisify(execFile);

export function getTimestamp() {
  return new Date().toISOString().replace(/:/g, "-").replace(/\..+/, "");
}

export async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export function normalizeProjectPath(filePath) {
  return filePath.replaceAll("\\", "/").replace(/^\/+/, "");
}

export async function selectFolderFromDialog(prompt) {
  const script = `
    set selectedFolder to choose folder with prompt "${prompt}"
    POSIX path of selectedFolder
  `;

  const { stdout } = await execFileAsync("osascript", ["-e", script]);
  const folderPath = stdout.trim();

  if (!folderPath) {
    throw new Error("Klasor secilmedi.");
  }

  return folderPath;
}

export async function resolveFolder(args, prompt) {
  const folderArg = readOption(args, "--folder");

  if (folderArg) {
    return path.resolve(folderArg);
  }

  return selectFolderFromDialog(prompt);
}

export async function resolveRequest(args) {
  const requestArg = readOption(args, "--request");

  if (requestArg) {
    return requestArg;
  }

  return getInput("Istegini yaz: ");
}

export function readOption(args, name) {
  const index = args.indexOf(name);

  if (index === -1) {
    return null;
  }

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${name} icin deger gerekli.`);
  }

  return value;
}

export function hasFlag(args, name) {
  return args.includes(name);
}
