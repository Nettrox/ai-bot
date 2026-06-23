export const ODYSSEUS_BASE_URL =
  process.env.ODYSSEUS_BASE_URL || "http://127.0.0.1:7000";

export const DEFAULT_MODEL = process.env.ODYSSEUS_MODEL || "gpt-5.5";

export const DEFAULT_ENDPOINT_URL =
  process.env.ODYSSEUS_ENDPOINT_URL ||
  "https://chatgpt.com/backend-api/codex/responses";

export const MAX_FILE_SIZE_TO_SEND = 200_000;
export const MAX_FILE_SIZE_TO_HASH = 500_000;
export const MAX_CHANGED_FILES_TO_SEND = 20;

export const PROTECTED_FILES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.development",
  ".session_id.txt",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml"
]);

export const PROTECTED_DIRS = new Set([
  ".context",
  ".git",
  "node_modules",
  ".backup",
  ".logs",
  ".dry-run",
  "dist",
  "build"
]);

export const IGNORED_DIRS = new Set([
  ...PROTECTED_DIRS,
  ".next",
  ".vite",
  ".turbo",
  "coverage"
]);

export const IGNORED_FILES = new Set([
  ".DS_Store",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  ".session_id.txt",
  "session_id.txt"
]);

export const BLOCKED_COMMAND_PATTERNS = [
  "sudo",
  "rm -rf",
  "del ",
  "format",
  "chmod -r 777",
  "mkfs",
  "shutdown",
  "reboot"
];
