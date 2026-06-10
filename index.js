import TelegramBot from "node-telegram-bot-api";
import "dotenv/config";

import { createNewSession } from "./func/createNewSession.js";
import { saveCurrentSession } from "./func/saveCurrentSession.js";
import { newAskOdysseus } from "./func/newAskOdysseus.js";
import { getLatestSessionId } from "./func/getLatestSessionId.js";
import { oldAskOdysseus } from "./func/oldAskOdysseus.js";

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, {
  polling: true
});

console.log("Bot çalışıyor...");

async function sendLongMessage(bot, chatId, text) {
  const maxLength = 4000;
  const message = String(text);

  for (let i = 0; i < message.length; i += maxLength) {
    const part = message.slice(i, i + maxLength);
    await bot.sendMessage(chatId, part);
  }
}

bot.on("message", async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text?.trim();

  if (!text) return;

  try {
    const lowerText = text.toLowerCase();

    if (lowerText.startsWith("nc!")) {
      const question = text.slice(3).trim();

      if (!question) {
        await bot.sendMessage(chatId, "Soru yazmadın. Örnek: nc! merhaba");
        return;
      }

      const sessionId = await createNewSession();

      console.log("New Session ID:", sessionId);
      console.log("Question:", question);

      const answer = await newAskOdysseus(sessionId, question);

      await saveCurrentSession(sessionId);

      console.log("Saved Session ID:", sessionId);

      await sendLongMessage(bot, chatId, answer);
      return;
    }

    if (lowerText.startsWith("c!")) {
      const soru = text.slice(2).trim();

      if (!soru) {
        await bot.sendMessage(chatId, "Soru yazmadın. Örnek: c! merhaba");
        return;
      }

      const lastSessionId = await getLatestSessionId();

      console.log("Old Session ID:", lastSessionId);
      console.log("Question:", soru);

      const answer = await oldAskOdysseus(lastSessionId, soru);

      await sendLongMessage(bot, chatId, answer);
      return;
    }

  } catch (err) {
    console.error("Bot hata:", err);

    await bot.sendMessage(
      chatId,
      "Bir hata oluştu. Terminalde detayını kontrol et."
    );
  }
});
