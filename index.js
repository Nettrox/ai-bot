import "dotenv/config";

import { getInput } from "./func/getInput.js";
import { createNewSession } from "./func/createNewSession.js";
import { saveCurrentSession } from "./func/saveCurrentSession.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { oldAskOdysseus } from "./func/oldAskOdysseus.js";
import { sendMail } from "./func/sendMail.js";

const systemPrompt = {
  system_prompt:
    "Bundan sonra sana aşağıdaki formatta veri vereceğim:\n\n{\n\"mail_adresi\": \"\",\n\"mail_basligi\": \"\",\n\"mail_icerigi\": \"\"\n}\n\nKurallar:\n\n* Mail adresinden kişinin adı ve soyadı yüksek doğrulukla çıkarılabiliyorsa mail içerisinde doğal şekilde kullan.\n* Çıkarılamıyorsa herhangi bir isim uydurma.\n* Mail içeriğini profesyonel ve akıcı şekilde oluştur.\n* Verilen bilgiler dışına yeni bilgi ekleme.\n* Kendi yorumunu, açıklamanı, önerini veya notunu ekleme.\n* Yanıtını yalnızca geçerli JSON olarak ver.\n* JSON dışında hiçbir metin yazma.\n* Kod bloğu kullanma.\n* Çıktı aşağıdaki formatta olacak:\n\n{\n\"mail_address\": \"...\",\n\"mail_subject\": \"...\",\n\"mail_topic\": \"...\"\n}\n\n* mail_address alanında bana verdiğim mail adresini aynen döndür.\n* mail_subject alanında oluşturduğun nihai e-posta konusu yer alacak.\n* mail_topic alanında gönderilmeye hazır e-posta gövdesi yer alacak.\n* Satır sonlarını ve paragraf düzenini mail_topic içerisinde koru.\n* JSON'un parse edilebilir ve geçerli olmasına dikkat et.",
  output_format: {
    mail_address: "",
    mail_subject: "",
    mail_topic: "",
  },
};

const mailAddress = await getInput("Mail address: ");
const mailSubject = await getInput("Subject: ");
const mailContent = await getInput("Topic-Question: ");

const userMailData = {
  mail_adresi: mailAddress,
  mail_basligi: mailSubject,
  mail_icerigi: mailContent,
};

const sessionId = await createNewSession();

console.log("New Session ID:", sessionId);

await newAskOdysseus(sessionId, JSON.stringify(systemPrompt));

await saveCurrentSession(sessionId);

const aiResponse = await oldAskOdysseus(
  sessionId,
  JSON.stringify(userMailData)
);

console.log("\nAI raw response:");
console.log(aiResponse);

let parsedMail;

try {
  parsedMail = JSON.parse(aiResponse);
} catch (error) {
  console.error("AI geçerli JSON döndürmedi.");
  console.error(aiResponse);
  process.exit(1);
}

await sendMail(
  parsedMail.mail_address,
  parsedMail.mail_subject,
  parsedMail.mail_topic
);

console.log("Mail başarıyla gönderildi.");