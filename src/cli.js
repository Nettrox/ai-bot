import path from "path";
import { askOdysseus, createSession } from "./odysseusClient.js";
import { isFolderEmpty } from "./projectScanner.js";
import {
  applyProjectPlan,
  createBackup,
  updateSnapshot
} from "./projectApplier.js";
import { runInstallCommandsWithAutoFix } from "./commandRunner.js";
import { createRunLog, saveRunLog } from "./logger.js";
import { parseProjectPlanWithRetry } from "./projectPlan.js";
import {
  buildDryRunAppliedNotification,
  buildProjectContextPrompt,
  buildUserPrompt,
  readSystemPrompt
} from "./promptBuilder.js";
import {
  readProjectSessionId
} from "./sessionStore.js";
import {
  hasFlag,
  resolveFolder,
  resolveRequest
} from "./utils.js";
import {
  printDryRun,
  readDryRunPlan,
  saveDryRunPlan
} from "./dryRun.js";

function printHelp() {
  console.log(`
AI Project Agent

Kullanim:
  node index.js
  node index.js --folder /path/to/project --request "Istek"
  node index.js --dry-run --folder /path/to/project --request "Istek"
  node index.js --apply-dry-run --folder /path/to/project

Secenekler:
  --folder <path>       Dialog acmadan proje klasoru sec
  --request <text>      Terminalden sormadan kullanici istegini ver
  --dry-run             Degisiklikleri uygulamadan plan dosyasi olustur
  --apply-dry-run       .dry-run/last-plan.json planini uygula
  --help                Bu yardimi goster
`);
}

async function prepareSession(selectedFolder, logData) {
  const existingSessionId = await readProjectSessionId(selectedFolder);
  const empty = await isFolderEmpty(selectedFolder);

  if (existingSessionId) {
    logData.mode = "existing_project";
    logData.session_id = existingSessionId;
    console.log("Mevcut session bulundu:", existingSessionId);

    return {
      sessionId: existingSessionId,
      existingProject: true,
      shouldBackup: true,
      isNewSession: false
    };
  }

  const sessionId = await createSession();

  if (!empty) {
    logData.mode = "adopt_existing_project";
    logData.session_id = sessionId;
    console.log("Session bulunamadi ama klasor dolu.");
    console.log("Yeni session olusturuldu:", sessionId);

    return {
      sessionId,
      existingProject: true,
      shouldBackup: true,
      isNewSession: true
    };
  }

  logData.mode = "new_project";
  logData.session_id = sessionId;
  console.log("Bos klasor secildi.");
  console.log("Yeni session olusturuldu:", sessionId);

  return {
    sessionId,
    existingProject: false,
    shouldBackup: false,
    isNewSession: true
  };
}

async function buildPlan({
  selectedFolder,
  userRequest,
  existingProject,
  sessionId,
  dryRun
}) {
  const systemPrompt = await readSystemPrompt();
  const projectName = path.basename(selectedFolder);
  const projectContext = existingProject
    ? await buildProjectContextPrompt(selectedFolder, projectName)
    : "";

  const answer = await askOdysseus(
    sessionId,
    buildUserPrompt({
      systemPrompt,
      userRequest,
      projectContext,
      dryRun
    })
  );

  const plan = await parseProjectPlanWithRetry({
    answer,
    sessionId,
    maxAttempts: 2
  });

  return { answer, plan };
}

async function handleDryRun({
  selectedFolder,
  userRequest,
  realSessionId,
  existingProject,
  logData
}) {
  const dryRunSessionId = await createSession();
  logData.dry_run_session_id = dryRunSessionId;

  console.log("Dry-run icin gecici session olusturuldu:", dryRunSessionId);

  const { answer, plan } = await buildPlan({
    selectedFolder,
    userRequest,
    existingProject,
    sessionId: dryRunSessionId,
    dryRun: true
  });

  const dryRunPath = await saveDryRunPlan(selectedFolder, plan, {
    user_request: userRequest,
    dry_run_session_id: dryRunSessionId,
    real_session_id: realSessionId,
    existing_project: existingProject,
    selected_folder: selectedFolder,
    created_at: new Date().toISOString()
  });

  logData.status = "dry_run";
  logData.model_response = answer;
  logData.project_data = plan;
  logData.dry_run_plan_path = dryRunPath;

  printDryRun(plan, existingProject);
  console.log("\nDry-run plan kaydedildi:", dryRunPath);
  console.log("Uygulamak icin: node index.js --apply-dry-run --folder", selectedFolder);

  await saveRunLog(logData, selectedFolder);
}

async function applyPlan({
  selectedFolder,
  plan,
  sessionId,
  existingProject,
  shouldBackup,
  logData
}) {
  if (shouldBackup) {
    console.log("\n=================================");
    console.log("BACKUP OLUSTURULUYOR");
    console.log("=================================");

    logData.backup_path = await createBackup(selectedFolder);
    console.log("Backup olusturuldu:", logData.backup_path);
  }

  const projectPath = await applyProjectPlan({
    baseFolder: selectedFolder,
    plan,
    sessionId,
    existingProject
  });

  await updateSnapshot(projectPath, logData);

  logData.project_path = projectPath;
  logData.install_commands = plan.install_commands || [];
  logData.run_commands = plan.run_commands || [];

  if (plan.install_commands?.length) {
    await runInstallCommandsWithAutoFix({
      commands: plan.install_commands,
      projectPath,
      sessionId,
      maxFixAttempts: 2,
      logData
    });
  }

  if (plan.run_commands?.length) {
    console.log("\nCalistirma komutlari:");
    for (const command of plan.run_commands) console.log("-", command);
  }

  return projectPath;
}

async function handleApplyDryRun(args, logData) {
  const selectedFolder = await resolveFolder(
    args,
    "Dry-run uygulanacak proje klasorunu sec"
  );

  logData.selected_folder = selectedFolder;
  logData.mode = "apply_dry_run";

  const savedPlan = await readDryRunPlan(selectedFolder);
  const plan = savedPlan.project_data;
  const metadata = savedPlan.metadata || {};

  let sessionId =
    metadata.real_session_id || (await readProjectSessionId(selectedFolder));
  let existingProject =
    metadata.existing_project !== undefined ? metadata.existing_project : true;

  if (!sessionId) {
    sessionId = await createSession();
    existingProject = false;
  }

  logData.session_id = sessionId;
  logData.project_data = plan;
  logData.dry_run_plan_path = path.join(
    selectedFolder,
    ".dry-run",
    "last-plan.json"
  );

  const projectPath = await applyPlan({
    selectedFolder,
    plan,
    sessionId,
    existingProject,
    shouldBackup: existingProject,
    logData
  });

  try {
    logData.model_response = await askOdysseus(
      sessionId,
      buildDryRunAppliedNotification(plan)
    );
  } catch (error) {
    logData.errors.push({
      type: "dry_run_apply_notification_error",
      message: error.message || String(error),
      timestamp: new Date().toISOString()
    });
  }

  logData.status = "success";
  await saveRunLog(logData, projectPath);
  console.log("\nDry-run plan gercek projeye uygulandi.");
}

export async function runCli() {
  const args = process.argv.slice(2);
  const logData = createRunLog();

  try {
    if (hasFlag(args, "--help")) {
      printHelp();
      return;
    }

    if (hasFlag(args, "--apply-dry-run")) {
      await handleApplyDryRun(args, logData);
      return;
    }

    const selectedFolder = await resolveFolder(args, "Proje klasorunu sec");
    const userRequest = await resolveRequest(args);

    logData.selected_folder = selectedFolder;
    logData.user_request = userRequest;

    const session = await prepareSession(selectedFolder, logData);

    if (hasFlag(args, "--dry-run") || process.env.DRY_RUN === "true") {
      await handleDryRun({
        selectedFolder,
        userRequest,
        realSessionId: session.sessionId,
        existingProject: session.existingProject,
        logData
      });
      return;
    }

    const { answer, plan } = await buildPlan({
      selectedFolder,
      userRequest,
      existingProject: session.existingProject,
      sessionId: session.sessionId,
      dryRun: false
    });

    logData.model_response = answer;
    logData.project_data = plan;

    const projectPath = await applyPlan({
      selectedFolder,
      plan,
      sessionId: session.sessionId,
      existingProject: session.existingProject,
      shouldBackup: session.shouldBackup,
      logData
    });

    logData.status = "success";
    await saveRunLog(logData, projectPath);

    console.log("\n=================================");
    console.log(session.existingProject ? "PROJE GUNCELLENDI" : "PROJE OLUSTURULDU");
    console.log("=================================");
    console.log("Proje yolu:", projectPath);
  } catch (error) {
    logData.status = "error";
    logData.errors.push({
      type: "fatal_error",
      message: error.message || String(error),
      timestamp: new Date().toISOString()
    });

    await saveRunLog(logData).catch(() => {});
    throw error;
  }
}
