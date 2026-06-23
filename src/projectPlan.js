import { askOdysseus } from "./odysseusClient.js";

export function extractJson(text) {
  const firstIndex = text.indexOf("{");
  const lastIndex = text.lastIndexOf("}");

  if (firstIndex === -1 || lastIndex === -1) {
    throw new Error("Model cevabinda JSON bulunamadi.");
  }

  return JSON.parse(text.slice(firstIndex, lastIndex + 1));
}

export function validateProjectPlan(plan) {
  const errors = [];

  if (!plan || typeof plan !== "object") {
    return ["JSON root object olmali."];
  }

  if (!["create", "update"].includes(plan.action)) {
    errors.push('action "create" veya "update" olmali.');
  }

  if (typeof plan.project_name !== "string" || !plan.project_name.trim()) {
    errors.push("project_name bos olmayan string olmali.");
  }

  for (const key of [
    "description",
    "folders",
    "files",
    "patches",
    "delete_files",
    "install_commands",
    "run_commands"
  ]) {
    if (key === "description") {
      if (typeof plan[key] !== "string") {
        errors.push("description string olmali.");
      }
      continue;
    }

    if (!Array.isArray(plan[key])) {
      errors.push(`${key} array olmali.`);
    }
  }

  if (Array.isArray(plan.files)) {
    for (const [index, file] of plan.files.entries()) {
      if (!file || typeof file !== "object") {
        errors.push(`files[${index}] object olmali.`);
        continue;
      }

      if (typeof file.path !== "string" || !file.path.trim()) {
        errors.push(`files[${index}].path bos olmayan string olmali.`);
      }

      if (typeof file.content !== "string") {
        errors.push(`files[${index}].content string olmali.`);
      }
    }
  }

  if (Array.isArray(plan.patches)) {
    for (const [index, patch] of plan.patches.entries()) {
      if (!patch || typeof patch !== "object") {
        errors.push(`patches[${index}] object olmali.`);
        continue;
      }

      if (typeof patch.path !== "string" || !patch.path.trim()) {
        errors.push(`patches[${index}].path bos olmayan string olmali.`);
      }

      if (typeof patch.search !== "string" || !patch.search) {
        errors.push(`patches[${index}].search bos olmayan string olmali.`);
      }

      if (typeof patch.replace !== "string") {
        errors.push(`patches[${index}].replace string olmali.`);
      }
    }
  }

  return errors;
}

export async function parseProjectPlanWithRetry({
  answer,
  sessionId,
  maxAttempts = 2
}) {
  let currentAnswer = answer;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const plan = extractJson(currentAnswer);
      const errors = validateProjectPlan(plan);

      if (errors.length === 0) {
        return plan;
      }

      throw new Error(errors.join("\n"));
    } catch (error) {
      if (attempt >= maxAttempts) {
        throw new Error(`Model gecerli JSON donduremedi:\n${error.message}`);
      }

      const retryPrompt = `
Son cevabin gecerli proje JSON formatina uymuyor.

Hatalar:
${error.message}

Onceki cevabin:
${currentAnswer}

Lutfen ayni cevabi sadece gecerli JSON olarak tekrar dondur.
Markdown, aciklama, kod blogu veya ekstra metin yazma.
Sadece JSON dondur.
`;

      console.log("\nJSON hatali. Modelden tekrar valid JSON isteniyor...");
      currentAnswer = await askOdysseus(sessionId, retryPrompt);
    }
  }
}
