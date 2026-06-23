import { askOdysseus } from "./odysseusClient.js";
import {
  applyProjectPlan,
  createBackup,
  runCommand,
  updateSnapshot
} from "./projectApplier.js";
import { parseProjectPlanWithRetry } from "./projectPlan.js";
import { buildErrorFixPrompt } from "./promptBuilder.js";

export async function runInstallCommandsWithAutoFix({
  commands,
  projectPath,
  sessionId,
  maxFixAttempts = 2,
  logData
}) {
  for (const command of commands || []) {
    let attempt = 0;

    while (attempt <= maxFixAttempts) {
      try {
        await runCommand(command, projectPath);
        break;
      } catch (commandError) {
        attempt++;

        console.log("\n=================================");
        console.log("KOMUT HATA VERDI");
        console.log("=================================");
        console.log(commandError.message);

        logData?.errors.push({
          type: "command_error",
          command: commandError.command,
          code: commandError.code,
          message: commandError.message,
          stdout: commandError.stdout,
          stderr: commandError.stderr,
          timestamp: new Date().toISOString()
        });

        if (attempt > maxFixAttempts) {
          throw new Error(
            `Komut ${maxFixAttempts} duzeltme denemesinden sonra basarisiz oldu: ${command}`
          );
        }

        console.log("\nHata modele gonderiliyor ve duzeltme isteniyor...");

        const fixAnswer = await askOdysseus(
          sessionId,
          buildErrorFixPrompt(commandError)
        );

        const fixPlan = await parseProjectPlanWithRetry({
          answer: fixAnswer,
          sessionId,
          maxAttempts: 2
        });

        logData?.errors.push({
          type: "auto_fix_response",
          model_response: fixAnswer,
          parsed_fix_data: fixPlan,
          timestamp: new Date().toISOString()
        });

        const backupPath = await createBackup(projectPath);
        console.log("Fix oncesi backup olusturuldu:", backupPath);

        await applyProjectPlan({
          baseFolder: projectPath,
          plan: fixPlan,
          sessionId,
          existingProject: true
        });
        await updateSnapshot(projectPath, logData);

        if (fixPlan.install_commands?.length) {
          for (const fixCommand of fixPlan.install_commands) {
            await runCommand(fixCommand, projectPath);
          }
        }

        console.log("\nOrijinal komut tekrar deneniyor...");
      }
    }
  }
}
