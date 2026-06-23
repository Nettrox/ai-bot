import fs from "fs/promises";
import path from "path";
import { fileExists } from "./utils.js";

export function printDryRun(plan, existingProject) {
  console.log("\n=================================");
  console.log("DRY RUN");
  console.log("=================================");
  console.log("\nMod:", existingProject ? "Mevcut Proje Guncellemesi" : "Yeni Proje");

  if (plan.folders?.length) {
    console.log("\nOlusturulacak klasorler:");
    for (const folder of plan.folders) console.log("-", folder);
  }

  if (plan.files?.length) {
    console.log("\nTam yazilacak/yeni dosyalar:");
    for (const file of plan.files) console.log("-", file.path);
  }

  if (plan.patches?.length) {
    console.log("\nPatch uygulanacak dosyalar:");
    for (const patch of plan.patches) console.log("-", patch.path);
  }

  if (plan.delete_files?.length) {
    console.log("\nSilinecek dosyalar:");
    for (const file of plan.delete_files) console.log("-", file);
  }

  if (plan.install_commands?.length) {
    console.log("\nCalistirilacak kurulum komutlari:");
    for (const command of plan.install_commands) console.log("-", command);
  }

  if (plan.run_commands?.length) {
    console.log("\nCalistirma komutlari:");
    for (const command of plan.run_commands) console.log("-", command);
  }

  console.log("\n=================================");
  console.log("DOSYA DEGISIKLIGI YAPILMADI");
  console.log("=================================");
}

export async function saveDryRunPlan(projectRoot, projectData, metadata = {}) {
  const dryRunDir = path.join(projectRoot, ".dry-run");
  await fs.mkdir(dryRunDir, { recursive: true });

  const dryRunPath = path.join(dryRunDir, "last-plan.json");
  await fs.writeFile(
    dryRunPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        metadata,
        project_data: projectData
      },
      null,
      2
    ),
    "utf8"
  );

  return dryRunPath;
}

export async function readDryRunPlan(projectRoot) {
  const dryRunPath = path.join(projectRoot, ".dry-run", "last-plan.json");

  if (!(await fileExists(dryRunPath))) {
    throw new Error(".dry-run/last-plan.json bulunamadi.");
  }

  return JSON.parse(await fs.readFile(dryRunPath, "utf8"));
}
