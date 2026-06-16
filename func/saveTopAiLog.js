import fs from "fs/promises";

const FILE_PATH = "top_ai.json";

async function readTopAiData() {
  try {
    const file = await fs.readFile(FILE_PATH, "utf8");
    const data = JSON.parse(file);
    return { records: Array.isArray(data.records) ? data.records : [] };
  } catch {
    return { records: [] };
  }
}

function normalizeRecord(record) {
  return {
    session_id: record.session_id || "",
    person_name: record.person_name || "",
    mail_adresi: record.mail_adresi || "",
  };
}

function extractMailAddresses(value) {
  const text = String(value || "");
  const emails = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);

  return emails?.length ? [...new Set(emails)] : [text.trim()].filter(Boolean);
}

function extractRecordsFromResponse(sessionId, response = {}) {
  const mails = Array.isArray(response.mails) ? response.mails : [];

  if (mails.length > 0) {
    return mails
      .filter((mail) => mail.mail_adresi)
      .flatMap((mail) =>
        extractMailAddresses(mail.mail_adresi).map((mailAddress) =>
          normalizeRecord({
            session_id: sessionId,
            person_name: mail.person_name || response.person_name || "",
            mail_adresi: mailAddress,
          })
        )
      );
  }

  if (Array.isArray(response.mail_adresleri)) {
    return response.mail_adresleri
      .filter(Boolean)
      .flatMap((mailAddress) =>
        extractMailAddresses(mailAddress).map((address) =>
          normalizeRecord({
            session_id: sessionId,
            person_name: response.person_name || "",
            mail_adresi: address,
          })
        )
      );
  }

  if (response.mail_adresi) {
    return extractMailAddresses(response.mail_adresi).map((mailAddress) =>
      normalizeRecord({
        session_id: sessionId,
        person_name: response.person_name || "",
        mail_adresi: mailAddress,
      })
    );
  }

  return [];
}

function upsertRecord(records, nextRecord) {
  const existingIndex = records.findIndex((record) => {
    if (nextRecord.mail_adresi && record.mail_adresi === nextRecord.mail_adresi) {
      return true;
    }

    return (
      nextRecord.person_name &&
      record.person_name &&
      record.person_name.toLocaleLowerCase("tr-TR") ===
        nextRecord.person_name.toLocaleLowerCase("tr-TR")
    );
  });

  if (existingIndex >= 0) {
    records[existingIndex] = {
      ...records[existingIndex],
      ...nextRecord,
    };
    return;
  }

  records.push(nextRecord);
}

export async function findTopAiSession({ mailAddress = "", personName = "" }) {
  const data = await readTopAiData();
  const normalizedPersonName = personName.toLocaleLowerCase("tr-TR");

  const record = data.records.find((item) => {
    if (mailAddress && item.mail_adresi === mailAddress) {
      return true;
    }

    return (
      normalizedPersonName &&
      item.person_name &&
      item.person_name.toLocaleLowerCase("tr-TR") === normalizedPersonName
    );
  });

  return record?.session_id || "";
}

export async function saveTopAiLog({ topSessionId, topAiResponse }) {
  const data = await readTopAiData();
  const nextRecords = extractRecordsFromResponse(topSessionId, topAiResponse);

  for (const record of nextRecords) {
    upsertRecord(data.records, record);
  }

  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf8");
}
