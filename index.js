import "dotenv/config";
import fs from "fs/promises";
import axios from "axios";
import * as cheerio from "cheerio";
import { search } from "duck-duck-scrape";

import { getInput } from "./func/getInput.js";
import { createNewSession } from "./func/createNewSession.js";
import { findTopAiSession, saveTopAiLog } from "./func/saveTopAiLog.js";
import { saveMailAiLog } from "./func/saveMailAiLog.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { oldAskOdysseus } from "./func/oldAskOdysseus.js";
import { sendMail } from "./func/sendMail.js";

const MAX_SEARCH_RESULTS = 5;
const REQUEST_TIMEOUT = 8000;

async function readJsonFile(path, fallback) {
  try {
    const file = await fs.readFile(path, "utf8");
    return JSON.parse(file);
  } catch {
    return fallback;
  }
}

function cleanJsonResponse(response) {
  return response.replace(/```json/g, "").replace(/```/g, "").trim();
}

function isSessionNotFoundError(error) {
  return (
    String(error?.message || "").includes("SESSION_NOT_FOUND") ||
    String(error?.message || "").includes("404")
  );
}

function normalizeMails(mailInput) {
  if (Array.isArray(mailInput.mails) && mailInput.mails.length > 0) {
    return mailInput.mails;
  }

  if (mailInput.mail_adresi) {
    return [mailInput];
  }

  return [];
}

function detectSendMode(text = "") {
  const lower = text.toLocaleLowerCase("tr-TR");

  if (
    /ayrı ayrı|ayri ayri|farklı farklı|farkli farkli|tek tek|her birine|her kişiye ayrı|her kisiye ayri/.test(
      lower
    )
  ) {
    return "separate";
  }

  if (
    /birlikte|beraber|tek mail|tek e-posta|tek email|aynı mail|ayni mail|aynı e-posta|ayni e-posta|hepsine aynı|hepsine ayni|toplu/.test(
      lower
    )
  ) {
    return "together";
  }

  return "";
}

function normalizeSendMode(value, fallbackText = "") {
  const lower = String(value || "").toLocaleLowerCase("tr-TR");

  if (["separate", "ayri", "ayrı", "ayrı_ayrı", "ayri_ayri"].includes(lower)) {
    return "separate";
  }

  if (["together", "birlikte", "toplu", "tek"].includes(lower)) {
    return "together";
  }

  if (["single", "tek_kisi", "tek_kişi"].includes(lower)) {
    return "single";
  }

  return detectSendMode(`${value || ""} ${fallbackText}`);
}

function extractMailAddresses(value) {
  if (Array.isArray(value)) {
    return value.flatMap(extractMailAddresses);
  }

  if (!value) {
    return [];
  }

  const emails = extractEmails(String(value));
  return emails.length > 0 ? emails : [String(value).trim()].filter(Boolean);
}

function buildTogetherMail(mailInput, mails) {
  const mailAddresses = [
    ...new Set(
      mails.flatMap((mail) =>
        extractMailAddresses(mail.mail_adresleri || mail.mail_adresi)
      )
    ),
  ];

  const firstMail = mails[0] || mailInput;

  return {
    mail_adresi: mailAddresses.join(", "),
    mail_basligi: mailInput.mail_basligi || firstMail.mail_basligi || "",
    mail_icerigi: mailInput.mail_icerigi || firstMail.mail_icerigi || "",
    person_name: mailInput.person_name || "",
    topic_name: mailInput.topic_name || firstMail.topic_name || "",
  };
}

function buildSeparateMails(mails) {
  return mails.flatMap((mail) => {
    const mailAddresses = extractMailAddresses(
      mail.mail_adresleri || mail.mail_adresi
    );

    if (mailAddresses.length <= 1) {
      return [mail];
    }

    return mailAddresses.map((mailAddress) => ({
      ...mail,
      mail_adresi: mailAddress,
      mail_adresleri: undefined,
    }));
  });
}

function buildSendPlan(mailInput, userCommand) {
  const requestedMode = normalizeSendMode(
    mailInput.send_mode || mailInput.gonderim_tipi,
    userCommand
  );

  let mails = normalizeMails(mailInput);

  if (mails.length === 0 && Array.isArray(mailInput.mail_adresleri)) {
    mails = mailInput.mail_adresleri.map((mailAddress) => ({
      ...mailInput,
      mail_adresi: mailAddress,
      mail_adresleri: undefined,
    }));
  }

  if (mails.length === 0) {
    return { status: "empty", mode: requestedMode, mails: [] };
  }

  const uniqueAddresses = [
    ...new Set(
      mails.flatMap((mail) =>
        extractMailAddresses(mail.mail_adresleri || mail.mail_adresi)
      )
    ),
  ];

  if (uniqueAddresses.length <= 1) {
    return { status: "ready", mode: "single", mails: [mails[0]] };
  }

  if (requestedMode === "together") {
    return {
      status: "ready",
      mode: "together",
      mails: [buildTogetherMail(mailInput, mails)],
    };
  }

  if (requestedMode === "separate") {
    return {
      status: "ready",
      mode: "separate",
      mails: buildSeparateMails(mails),
    };
  }

  return {
    status: "needs_send_mode",
    mode: "",
    mails,
    recipientCount: uniqueAddresses.length,
  };
}

function extractEmails(text) {
  const regex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  return [...new Set(text.match(regex) || [])];
}

function isProbablyUsefulEmail(email) {
  const lower = email.toLowerCase();

  const blocked = [
    "example.com",
    "domain.com",
    "email.com",
    "yourmail",
    "sentry.io",
    "wixpress.com",
    "wordpress.com",
    "shopify.com",
    "schema.org",
  ];

  return !blocked.some((x) => lower.includes(x));
}

function absoluteUrl(baseUrl, href) {
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return null;
  }
}

async function fetchPage(url) {
  try {
    const res = await axios.get(url, {
      timeout: REQUEST_TIMEOUT,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      },
      maxRedirects: 3,
    });

    return res.data;
  } catch {
    return "";
  }
}

async function findContactLinks(baseUrl, html) {
  const $ = cheerio.load(html);
  const links = [];

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    const text = $(el).text().toLowerCase();

    if (!href) return;

    const combined = `${href} ${text}`.toLowerCase();

    if (
      combined.includes("contact") ||
      combined.includes("iletisim") ||
      combined.includes("iletişim") ||
      combined.includes("bize-ulas") ||
      combined.includes("bize-ulaş") ||
      combined.includes("kurumsal")
    ) {
      const fullUrl = absoluteUrl(baseUrl, href);
      if (fullUrl) links.push(fullUrl);
    }
  });

  return [...new Set(links)].slice(0, 3);
}

async function searchEmailsWithDuckDuckGo(query) {
  let results = [];

  try {
    const searchResult = await search(query);
    results = searchResult.results || [];
  } catch (error) {
    console.log("[WARN] DuckDuckGo package hata verdi, HTML fallback deneniyor...");

    const html = await fetchPage(
      `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    );

    const $ = cheerio.load(html);

    $(".result").each((_, el) => {
      const title = $(el).find(".result__title").text().trim();
      const url = $(el).find(".result__a").attr("href");
      const description = $(el).find(".result__snippet").text().trim();

      if (url) {
        results.push({
          title,
          url,
          description,
        });
      }
    });
  }

  const recipients = [];

  for (const result of results.slice(0, MAX_SEARCH_RESULTS)) {
    const url = result.url;
    const title = result.title || "";
    const snippet = result.description || "";

    if (!url) continue;

    const directEmails = extractEmails(`${title} ${snippet}`).filter(
      isProbablyUsefulEmail
    );

    for (const email of directEmails) {
      recipients.push({
        name: title,
        email,
        source: url,
        note: "Arama sonucunda bulundu",
      });
    }

    const html = await fetchPage(url);
    if (!html) continue;

    const pageEmails = extractEmails(html).filter(isProbablyUsefulEmail);

    for (const email of pageEmails) {
      recipients.push({
        name: title,
        email,
        source: url,
        note: "Web sitesinde bulundu",
      });
    }

    const contactLinks = await findContactLinks(url, html);

    for (const contactUrl of contactLinks) {
      const contactHtml = await fetchPage(contactUrl);
      const contactEmails = extractEmails(contactHtml).filter(
        isProbablyUsefulEmail
      );

      for (const email of contactEmails) {
        recipients.push({
          name: title,
          email,
          source: contactUrl,
          note: "İletişim sayfasında bulundu",
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    await new Promise((resolve) => setTimeout(resolve, 1200));
  }

  const unique = new Map();

  for (const recipient of recipients) {
    if (!unique.has(recipient.email)) {
      unique.set(recipient.email, recipient);
    }
  }

  return {
    status: unique.size > 0 ? "found" : "not_found",
    search_query: query,
    recipients: [...unique.values()],
    user_message:
      unique.size > 0
        ? `${unique.size} adet e-posta adresi bulundu.`
        : "E-posta adresi bulunamadı.",
  };
}

function buildMailsFromSearchRecipients(mailInput, searchResult) {
  const recipients = Array.isArray(searchResult.recipients)
    ? searchResult.recipients
    : [];

  return recipients
    .filter((r) => r.email)
    .map((recipient) => ({
      mail_adresi: recipient.email,
      mail_basligi: mailInput.mail_basligi || "Bilgi Talebi",
      mail_icerigi:
        mailInput.mail_icerigi ||
        "Merhaba,\n\nKonu hakkında bilgi almak istiyorum.\n\nTeşekkürler.",
      person_name: recipient.name || "",
      topic_name: mailInput.topic_name || "",
      source: recipient.source || "",
      note: recipient.note || "",
    }));
}

async function main() {
  const promptData = await readJsonFile("prompt.json", {
    top_ai: {},
    mail_ai: {},
  });

  const topAiData = await readJsonFile("top_ai.json", {
    records: [],
  });

  if (!promptData.top_ai?.system_prompt) {
    console.error("prompt.json içinde top_ai.system_prompt yok.");
    process.exit(1);
  }

  if (!promptData.mail_ai?.system_prompt) {
    console.error("prompt.json içinde mail_ai.system_prompt yok.");
    process.exit(1);
  }

  const topAiPrompt = promptData.top_ai;
  const mailSystemPrompt = promptData.mail_ai;

  const userCommand = await getInput("Mail komutu: ");

  const topSessionId = await createNewSession();

  console.log("Top AI Session ID:", topSessionId);

  await newAskOdysseus(topSessionId, JSON.stringify(topAiPrompt));

  const topAiInput = {
    kullanici_komutu: userCommand,
    top_ai_json: topAiData,
  };

  const topAiRawResponse = await oldAskOdysseus(
    topSessionId,
    JSON.stringify(topAiInput)
  );

  console.log("\nTop AI raw response:");
  console.log(topAiRawResponse);
  await saveMailAiLog("top_ai_raw_response", {
    session_id: topSessionId,
    user_command: userCommand,
    response: topAiRawResponse,
  });

  let mailInput;

  try {
    mailInput = JSON.parse(cleanJsonResponse(topAiRawResponse));
  } catch {
    console.error("Top AI geçerli JSON döndürmedi.");
    console.error(topAiRawResponse);
    process.exit(1);
  }

  if (mailInput.status === "missing_info") {
    console.log("\nEksik bilgi var:");
    console.log(mailInput.user_message);

    const extraInfo = await getInput("Eksik bilgi cevabı: ");

    const completedInput = {
      onceki_cevap: mailInput,
      kullanici_ek_bilgisi: extraInfo,
      top_ai_json: topAiData,
      gorev:
        "Eksik bilgileri tamamla. Tek alıcı varsa tek mail formatında dön. Birden fazla alıcı varsa kullanıcı ayrı ayrı istediyse send_mode separate ve mails array'i dön; birlikte/tek mail istediyse send_mode together ve mail_adresleri array'i ile tek mail içeriği dön. Kullanıcı bunu belirtmediyse missing_info dönüp gonderim_tipi bilgisini iste. Status yalnızca hazırsa ready olmalı.",
    };

    const retryRawResponse = await oldAskOdysseus(
      topSessionId,
      JSON.stringify(completedInput)
    );

    console.log("\nTop AI retry raw response:");
    console.log(retryRawResponse);
    await saveMailAiLog("top_ai_retry_raw_response", {
      session_id: topSessionId,
      user_command: userCommand,
      response: retryRawResponse,
    });

    try {
      mailInput = JSON.parse(cleanJsonResponse(retryRawResponse));
    } catch {
      console.error("Top AI ikinci cevapta geçerli JSON döndürmedi.");
      console.error(retryRawResponse);
      process.exit(1);
    }

  }

  if (mailInput.status === "search_required") {
    console.log("\nWeb araması yapılıyor...");
    console.log("Search query:", mailInput.search_query);

    const searchResult = await searchEmailsWithDuckDuckGo(
      mailInput.search_query
    );

    console.log(searchResult.user_message);

    const searchSessionId = await createNewSession();

    await saveMailAiLog("web_search_result", {
      session_id: searchSessionId,
      search_query: mailInput.search_query,
      response: searchResult,
    });

    await saveTopAiLog({
      topSessionId: searchSessionId,
      topAiResponse: {
        mails: searchResult.recipients.map((recipient) => ({
          person_name: recipient.name || "",
          mail_adresi: recipient.email || "",
        })),
      },
    });

    if (searchResult.status !== "found") {
      console.log("Arama sonucu alıcı bulunamadı.");
      process.exit(0);
    }

    const foundMails = buildMailsFromSearchRecipients(mailInput, searchResult);

    if (foundMails.length === 0) {
      console.log("Arama sonucu mail adresi bulunamadı.");
      process.exit(0);
    }

    mailInput = {
      status: "ready",
      mails: foundMails,
      send_mode: mailInput.send_mode || detectSendMode(userCommand),
      search_query: mailInput.search_query,
      user_message: "",
      missing_fields: [],
    };

  }

  if (mailInput.status !== "ready") {
    console.error("Top AI mail göndermeye hazır veri döndürmedi.");
    console.error(mailInput);
    process.exit(1);
  }

  let sendPlan = buildSendPlan(mailInput, userCommand);

  if (sendPlan.status === "needs_send_mode") {
    console.log(
      `${sendPlan.recipientCount} alıcı bulundu. Birlikte mi ayrı ayrı mı gönderilsin?`
    );

    const sendModeAnswer = await getInput("Gönderim tipi: ");
    const selectedMode = normalizeSendMode(sendModeAnswer);

    if (!["together", "separate"].includes(selectedMode)) {
      console.error("Gönderim tipi anlaşılamadı. 'birlikte' veya 'ayrı ayrı' yaz.");
      process.exit(1);
    }

    const modeCompletedInput = {
      onceki_cevap: mailInput,
      kullanici_gonderim_tipi: sendModeAnswer,
      top_ai_json: topAiData,
      gorev:
        selectedMode === "separate"
          ? "Alıcıları ayrı ayrı mail gönderilecek şekilde düzenle. send_mode separate olmalı ve her alıcı için mails array'i içinde ayrı mail_adresi, mail_basligi, mail_icerigi üret. Status ready olmalı."
          : "Alıcıları birlikte tek mail gönderilecek şekilde düzenle. send_mode together olmalı, mail_adresleri array'i ve tek mail_basligi/mail_icerigi üret. Status ready olmalı.",
    };

    const modeRawResponse = await oldAskOdysseus(
      topSessionId,
      JSON.stringify(modeCompletedInput)
    );

    console.log("\nTop AI gönderim tipi raw response:");
    console.log(modeRawResponse);
    await saveMailAiLog("top_ai_send_mode_raw_response", {
      session_id: topSessionId,
      user_command: `${userCommand} | Gönderim tipi: ${sendModeAnswer}`,
      response: modeRawResponse,
    });

    try {
      mailInput = JSON.parse(cleanJsonResponse(modeRawResponse));
    } catch {
      console.error("Top AI gönderim tipi cevabında geçerli JSON döndürmedi.");
      console.error(modeRawResponse);
      process.exit(1);
    }

    mailInput.send_mode = mailInput.send_mode || selectedMode;

    sendPlan = buildSendPlan(mailInput, `${userCommand} ${sendModeAnswer}`);
  }

  const mailsToSend = sendPlan.mails;

  if (sendPlan.status !== "ready" || mailsToSend.length === 0) {
    console.error("Gönderilecek mail bulunamadı.");
    console.error(mailInput);
    process.exit(1);
  }

  if (sendPlan.mode === "together") {
    console.log("Alıcıların tamamına tek mail gönderilecek.");
  } else if (sendPlan.mode === "separate") {
    console.log(`${mailsToSend.length} adet mail ayrı ayrı gönderilecek.`);
  } else {
    console.log("Tek alıcıya mail gönderilecek.");
  }

  for (const currentMail of mailsToSend) {
    if (!currentMail.mail_adresi) {
      console.error("Mail adresi olmayan kayıt atlandı:");
      console.error(currentMail);
      continue;
    }

    const existingMailSessionId = await findTopAiSession({
      mailAddress: currentMail.mail_adresi,
      personName: currentMail.person_name,
    });
    let mailSessionId = existingMailSessionId || (await createNewSession());

    console.log("\nMail AI Session ID:", mailSessionId);
    console.log("Alıcı:", currentMail.mail_adresi);

    if (!existingMailSessionId) {
      await newAskOdysseus(mailSessionId, JSON.stringify(mailSystemPrompt));
    }

    let mailAiRawResponse;

    try {
      mailAiRawResponse = await oldAskOdysseus(
        mailSessionId,
        JSON.stringify(currentMail)
      );
    } catch (error) {
      if (!existingMailSessionId || !isSessionNotFoundError(error)) {
        throw error;
      }

      await saveMailAiLog("mail_ai_session_not_found", {
        session_id: existingMailSessionId,
        mail_address: currentMail.mail_adresi,
        error: error.message,
      });

      mailSessionId = await createNewSession();
      console.log(
        "Kayıtlı session bulunamadı, yeni Mail AI Session ID:",
        mailSessionId
      );

      await newAskOdysseus(mailSessionId, JSON.stringify(mailSystemPrompt));
      mailAiRawResponse = await oldAskOdysseus(
        mailSessionId,
        JSON.stringify(currentMail)
      );
    }

    console.log("\nMail AI raw response:");
    console.log(mailAiRawResponse);
    await saveMailAiLog("mail_ai_raw_response", {
      session_id: mailSessionId,
      input: currentMail,
      response: mailAiRawResponse,
    });

    let parsedMail;

    try {
      parsedMail = JSON.parse(cleanJsonResponse(mailAiRawResponse));
    } catch {
      console.error("Mail AI geçerli JSON döndürmedi.");
      console.error(mailAiRawResponse);
      continue;
    }

    if (
      !parsedMail.mail_address ||
      !parsedMail.mail_subject ||
      !parsedMail.mail_topic
    ) {
      console.error("Mail AI eksik alan döndürdü:");
      console.error(parsedMail);
      continue;
    }

    await sendMail(
      parsedMail.mail_address,
      parsedMail.mail_subject,
      parsedMail.mail_topic
    );

    await saveTopAiLog({
      topSessionId: mailSessionId,
      topAiResponse: {
        person_name: currentMail.person_name || parsedMail.person_name || "",
        mail_adresi: parsedMail.mail_address,
      },
    });

    await saveMailAiLog("mail_sent", {
      session_id: mailSessionId,
      mail_address: parsedMail.mail_address,
      mail_subject: parsedMail.mail_subject,
    });

    console.log(`Mail gönderildi: ${parsedMail.mail_address}`);
  }

  console.log("Mail gönderim işlemi tamamlandı.");
}

main().catch((error) => {
  console.error("Beklenmeyen hata:");
  console.error(error);
  process.exit(1);
});
