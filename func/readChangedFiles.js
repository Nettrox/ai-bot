import fs from "fs/promises";
import path from "path";

const MAX_FILE_SIZE = 200_000;

export async function readChangedFiles(
  projectRoot,
  changedFiles
) {
  const result = [];

  for (const relativePath of changedFiles) {
    const fullPath = path.join(
      projectRoot,
      relativePath
    );

    try {
      const stat =
        await fs.stat(fullPath);

      if (stat.size > MAX_FILE_SIZE) {
        result.push({
          path: relativePath,
          content:
            "[SKIPPED: file too large]"
        });

        continue;
      }

      const content =
        await fs.readFile(
          fullPath,
          "utf8"
        );

      result.push({
        path: relativePath,
        content
      });
    } catch {
      result.push({
        path: relativePath,
        content:
          "[SKIPPED: file missing]"
      });
    }
  }

  return result;
}