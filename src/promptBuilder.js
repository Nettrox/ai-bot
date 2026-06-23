import fs from "fs/promises";
import path from "path";
import { MAX_CHANGED_FILES_TO_SEND } from "./config.js";
import {
  getChangedFiles,
  readChangedFiles,
  scanProjectFiles
} from "./projectScanner.js";

export async function readSystemPrompt() {
  return fs.readFile(path.resolve("prompt/project_generator.txt"), "utf8");
}

function buildExistingProjectPrompt(projectName, files) {
  return `
MEVCUT PROJE BILGILERI:

project_name: ${projectName}

Aşağıda seçilen klasördeki mevcut proje dosyaları var.
Bu dosyaları mevcut proje olarak kabul et.
Yeni proje oluşturma.
Bundan sonraki isteği bu mevcut proje üzerinden uygula.

${JSON.stringify({ project_name: projectName, files }, null, 2)}
`;
}

function buildChangedFilesPrompt(changedData, changedFilesContent) {
  return `
MEVCUT PROJE DEGISIKLIK ANALIZI:

Snapshot karşılaştırmasına göre projede değişen dosyalar aşağıdadır.
Bu bilgiler mevcut proje bağlamını güncellemek için verilmiştir.

Added Files:
${JSON.stringify(changedData.added_files, null, 2)}

Modified Files:
${JSON.stringify(changedData.modified_files, null, 2)}

Deleted Files:
${JSON.stringify(changedData.deleted_files, null, 2)}

Skipped Files:
${JSON.stringify(changedData.skipped_files, null, 2)}

DEGISEN DOSYA ICERIKLERI:

${JSON.stringify(changedFilesContent, null, 2)}
`;
}

export async function buildProjectContextPrompt(projectRoot, projectName) {
  const changedData = await getChangedFiles(projectRoot);

  if (
    changedData.has_snapshot &&
    changedData.changed_files.length > 0 &&
    changedData.changed_files.length <= MAX_CHANGED_FILES_TO_SEND
  ) {
    const changedFilesContent = await readChangedFiles(
      projectRoot,
      changedData.changed_files
    );

    console.log(
      "Snapshot kullanildi. Degisen dosya sayisi:",
      changedData.changed_files.length
    );

    return buildChangedFilesPrompt(changedData, changedFilesContent);
  }

  if (changedData.has_snapshot && changedData.changed_files.length === 0) {
    console.log("Snapshot kullanildi. Diskte degisen dosya yok.");

    return `
MEVCUT PROJE SNAPSHOT BILGISI:

Snapshot mevcut ve son snapshot'a gore disk uzerinde degisen dosya bulunamadi.
Onceki session baglamini ve kullanicinin istegini dikkate alarak devam et.
`;
  }

  console.log("Tam proje taramasi yapildi.");
  return buildExistingProjectPrompt(
    projectName,
    await scanProjectFiles(projectRoot)
  );
}

export function buildUserPrompt({
  systemPrompt,
  userRequest,
  projectContext = "",
  dryRun = false
}) {
  const dryRunBlock = dryRun
    ? `
DRY-RUN MODU AKTIF.

Bu istek sadece on izleme icindir.
Bu degisiklikler henuz gercek proje dosyalarina uygulanmayacak.
Bu dry-run sonucunu, acikca apply edildigi bildirilmedikce mevcut proje durumu olarak kabul etme.
`
    : "";

  return `
${systemPrompt}

${dryRunBlock}

${projectContext}

KULLANICI ISTEGI:

${userRequest}
`;
}

export function buildDryRunAppliedNotification(projectData) {
  return `
DRY-RUN APPLY BILDIRIMI:

Aşağıdaki dry-run planı gerçek proje dosyalarına başarıyla uygulandı.
Bundan sonraki isteklerde bu değişiklikleri mevcut proje durumuna dahil et.

UYGULANAN PLAN:

${JSON.stringify(projectData, null, 2)}

Bu sadece session güncelleme bildirimidir.
Yeni dosya üretme.
Eğer cevap vermen gerekiyorsa yalnızca geçerli JSON formatında boş update cevabı döndür.
`;
}

export function buildErrorFixPrompt(commandError) {
  return `
OTOMATIK HATA DUZELTME ISTEGI:

Aşağıdaki komut çalıştırılırken hata oluştu.

COMMAND:
${commandError.command}

EXIT_CODE:
${commandError.code ?? "unknown"}

STDOUT:
${commandError.stdout || ""}

STDERR:
${commandError.stderr || ""}

MESSAGE:
${commandError.message || ""}

Bu hatayı mevcut proje üzerinde düzelt.
Sadece geçerli JSON döndür.
`;
}
